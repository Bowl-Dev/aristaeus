#include "MQTTManager.h"
#include "Protocol.h"
#include "Config.h"
#include <WiFi.h>
#include <ESPmDNS.h>
#include "MachineController.h"

MQTTManager* MQTTManager::instance = nullptr;

MQTTManager::MQTTManager(MachineController& ctrl, Protocol& proto)
    :
    controller(ctrl),
    protocol(proto),
    mqtt(wifiClient)
  {
    instance = this;
  }

void MQTTManager::begin()
{
    Serial.println("MQTTManager::begin()");

    // Default PubSubClient buffer is 256 bytes, which the status JSON
    // (topic + payload + MQTT header) already exceeds. Give it headroom.
    mqtt.setBufferSize(1024);

    // Default keepalive is 15s: on a weak WiFi link one stalled ping/reply is
    // enough to trip a "connection timeout" (-4) and drop the session. Allow
    // 30s. Blocking here only ever stalls the network task now, never the
    // dispensing control loop.
    mqtt.setKeepAlive(30);
    mqtt.setSocketTimeout(3);

    // WiFi isn't connected yet at this point (wifiManager.begin() just
    // started the connection attempt, non-blocking), so mDNS can't resolve
    // anything yet either - start out pointed at the fallback IP.
    // reconnect() takes over via mDNS as soon as WiFi actually comes up,
    // and keeps the address current from then on even if the PC's IP
    // changes later.
    brokerAddress.fromString(MQTT_SERVER_FALLBACK);
    mqtt.setServer(brokerAddress, MQTT_PORT);
    Serial.print("MQTT broker (fallback, until mDNS resolves " MQTT_BROKER_HOSTNAME ".local): ");
    Serial.println(brokerAddress);

    mqtt.setCallback(mqttCallback);

    // Queues between the control loop and the network task.
    statusQueue  = xQueueCreate(1, STATUS_MAX);          // newest status only
    eventQueue   = xQueueCreate(16, EVENT_MAX);
    commandQueue = xQueueCreate(8, sizeof(CommandMsg));

    // Core 0 (where the WiFi stack runs); the Arduino loop() runs on core 1.
    BaseType_t ok = xTaskCreatePinnedToCore(
        networkTaskEntry, "mqttNet", 10240, this, 1, nullptr, 0);

    if (ok != pdPASS)
        Serial.println("ERROR: could not start MQTT network task");
}

// ---------------------------------------------------------------------------
// Network task (core 0) - the only code that touches `mqtt`.
// ---------------------------------------------------------------------------

void MQTTManager::networkTaskEntry(void* arg)
{
    static_cast<MQTTManager*>(arg)->networkLoop();
}

void MQTTManager::networkLoop()
{
    char statusBuf[STATUS_MAX];
    char eventBuf[EVENT_MAX];

    for (;;)
    {
        reconnect();

        mqtt.loop();

        mqttUp = mqtt.connected();
        mqttState = mqtt.state();

        if (mqttUp)
        {
            // Events first and in order, then the newest status. A publish
            // can block here for seconds on a bad link - that only delays
            // this task, not the control loop.
            while (mqttUp && xQueueReceive(eventQueue, eventBuf, 0) == pdTRUE)
            {
                mqtt.publish(MQTT_EVENT_TOPIC, eventBuf);
                mqttUp = mqtt.connected();
            }

            if (mqttUp && xQueueReceive(statusQueue, statusBuf, 0) == pdTRUE)
            {
                mqtt.publish(MQTT_STATUS_TOPIC, statusBuf);
                mqttUp = mqtt.connected();
            }

            mqttState = mqtt.state();
        }

        vTaskDelay(pdMS_TO_TICKS(5));
    }
}

void MQTTManager::resolveBrokerAddress()
{
    // Blocks this (network) task for up to this long - a missed lookup just
    // means we try again on the next reconnect attempt.
    uint32_t t0 = millis();
    IPAddress resolved = MDNS.queryHost(MQTT_BROKER_HOSTNAME, 500);
    uint32_t took = millis() - t0;
    if (took > 300)
    {
        Serial.print("DIAG: mDNS lookup took ");
        Serial.print(took);
        Serial.println(" ms");
    }

    if (resolved == IPAddress(0, 0, 0, 0))
    {
        // Lookup failed - keep using whatever address we already have (the
        // fallback IP, or the last one that DID resolve) instead of losing
        // a known-good address over one missed query.
        Serial.println("mDNS lookup failed, keeping current broker address");
        return;
    }

    if (resolved != brokerAddress)
    {
        Serial.print("Broker resolved via mDNS (" MQTT_BROKER_HOSTNAME ".local): ");
        Serial.println(resolved);
    }

    brokerAddress = resolved;
}

void MQTTManager::reconnect()
{
    if (WiFi.status() != WL_CONNECTED)
    {
        // Re-init mDNS next time WiFi comes back, in case the interface
        // dropped and got a different IP of its own in the meantime.
        mdnsStarted = false;
        return;
    }

    if (mqtt.connected())
        return;

    uint32_t now = millis();

    if (now - lastReconnectAttempt < 5000)
        return;

    lastReconnectAttempt = now;

    if (!mdnsStarted)
    {
        mdnsStarted = MDNS.begin(DEVICE_ID);
        if (!mdnsStarted)
            Serial.println("mDNS init failed");
    }

    // Re-resolve on every reconnect attempt (at most once per 5s thanks to
    // the backoff above) rather than once at boot - this is what lets the
    // firmware follow the broker to a new IP automatically if it changes
    // while we're disconnected, with no reflash needed.
    resolveBrokerAddress();
    mqtt.setServer(brokerAddress, MQTT_PORT);

    Serial.println("Connecting MQTT...");

    uint32_t connectStart = millis();
    bool connectedOk = mqtt.connect(MQTT_CLIENT_ID);
    uint32_t connectMs = millis() - connectStart;
    if (connectMs > 500)
    {
        Serial.print("DIAG: mqtt.connect() took ");
        Serial.print(connectMs);
        Serial.println(" ms (network task only)");
    }

    if (!connectedOk)
    {
        Serial.print("Connect failed. State = ");
        Serial.println(mqtt.state());
        return;
    }

    Serial.println("MQTT connected");

    if (mqtt.subscribe(MQTT_COMMAND_TOPIC))
    {
        Serial.print("Subscribed to ");
        Serial.println(MQTT_COMMAND_TOPIC);
    }
    else
    {
        Serial.println("Subscribe FAILED");
    }
}

// Runs inside mqtt.loop(), i.e. on the network task: just hand the command
// to the control loop - it must be executed there, not here.
void MQTTManager::mqttCallback(char* topic, uint8_t* payload, unsigned int length)
{
    (void)topic;

    if (instance)
        instance->enqueueCommand(payload, length);
}

void MQTTManager::enqueueCommand(const uint8_t* payload, unsigned int length)
{
    if (length >= COMMAND_MAX)
    {
        Serial.println("Payload too large");
        return;
    }

    CommandMsg msg;
    memcpy(msg.json, payload, length);
    msg.json[length] = '\0';

    if (xQueueSend(commandQueue, &msg, 0) != pdTRUE)
        Serial.println("Command queue full, command dropped");
}

// ---------------------------------------------------------------------------
// Control-loop side (core 1) - never blocks on the network.
// ---------------------------------------------------------------------------

void MQTTManager::update()
{
    CommandMsg msg;

    while (xQueueReceive(commandQueue, &msg, 0) == pdTRUE)
        processCommand(msg.json);
}

void MQTTManager::processCommand(const char* json)
{
    Serial.print("MQTT command: ");
    Serial.println(json);

    JobRequest request;

    if (protocol.parse(json, request))
    {
        Serial.println("Protocol parse OK");

        Serial.print("Queueing actuator ");
        Serial.println(request.actuator);

        controller.processJobRequest(request);

        Serial.print("Target weight: ");
        Serial.println(request.targetWeight);

        Serial.print("Speed: ");
        Serial.println(request.speed);
    }
    else
    {
        Serial.println("Protocol parse FAILED");
    }
}

bool MQTTManager::connected()
{
    return mqttUp;
}

bool MQTTManager::publishStatus(const char* status)
{
    if (!mqttUp || !statusQueue)
        return false;

    char buf[STATUS_MAX];
    strncpy(buf, status, STATUS_MAX - 1);
    buf[STATUS_MAX - 1] = '\0';

    // Length-1 queue: replaces any older status still waiting to go out.
    return xQueueOverwrite(statusQueue, buf) == pdTRUE;
}

bool MQTTManager::publishEvent(const char* payload)
{
    if (!eventQueue)
        return false;

    char buf[EVENT_MAX];
    strncpy(buf, payload, EVENT_MAX - 1);
    buf[EVENT_MAX - 1] = '\0';

    if (xQueueSend(eventQueue, buf, 0) != pdTRUE)
    {
        Serial.println("Event queue full, event dropped");
        return false;
    }

    return true;
}
