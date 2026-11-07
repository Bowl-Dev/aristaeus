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
}

void MQTTManager::resolveBrokerAddress()
{
    IPAddress resolved = MDNS.queryHost(MQTT_BROKER_HOSTNAME, 2000);

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

bool MQTTManager::connected()
{
    return mqtt.connected();
}

void MQTTManager::mqttCallback(char* topic, uint8_t* payload, unsigned int length)
{
    if (instance)
    {
        instance->handleMessage(topic, payload, length);
    }
}

void MQTTManager::handleMessage(char* topic, uint8_t* payload, unsigned int length)
{
    Serial.print("MQTT topic: ");
    Serial.println(topic);

    constexpr size_t MAX_PAYLOAD = 256;

    if (length >= MAX_PAYLOAD)
    {
        Serial.println("Payload too large");
        return;
    }

    char json[MAX_PAYLOAD];

    memcpy(json, payload, length);
    json[length] = '\0';

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

    if (!mqtt.connect(MQTT_CLIENT_ID))
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

void MQTTManager::update()
{
    reconnect();
    mqtt.loop();
}

bool MQTTManager::publishStatus(const char* status)
{
    if (!mqtt.connected())
        return false;    

    return mqtt.publish(MQTT_STATUS_TOPIC, status);
}

bool MQTTManager::publishEvent(const char* payload)
{
    if (!connected())
        return false;
    return mqtt.publish(MQTT_EVENT_TOPIC, payload);
}