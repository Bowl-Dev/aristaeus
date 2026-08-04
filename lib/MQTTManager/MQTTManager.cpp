#include "MQTTManager.h"
#include "Protocol.h"
#include "Config.h"
#include <WiFi.h>
#include "MachineController.h"

namespace
{
    const char* toString(MachineMode mode)
    {
        switch (mode)
        {
            case MachineMode::Booting:
                return "booting";

            case MachineMode::Initializing:
                return "initializing";

            case MachineMode::Ready:
                return "ready";

            case MachineMode::Running:
                return "running";

            case MachineMode::Paused:
                return "paused";

            case MachineMode::Error:
                return "error";

            case MachineMode::EmergencyStop:
                return "emergency_stop";

            default:
                return "unknown";
        }
    }
}

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
    mqtt.setServer(MQTT_SERVER, MQTT_PORT);
    Serial.print("MQTT server: ");
    Serial.print(MQTT_SERVER);
    Serial.print(":");
    Serial.println(MQTT_PORT);
    mqtt.setCallback(mqttCallback);
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
        return;

    if (mqtt.connected())
        return;

    uint32_t now = millis();

    if (now - lastReconnectAttempt < 5000)
        return;

    lastReconnectAttempt = now;

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
   
   MachineMode mode = controller.state().mode;
    if (mode != lastPublishedMode)
    {
        if (publishStatus(toString(mode)))
        {
            lastPublishedMode = mode;
        }
    }
}

bool MQTTManager::publishStatus(const char* status)
{
    if (!mqtt.connected())
        return false;

    /*char payload[256];

    snprintf(payload, sizeof(payload), "{\"mode\":\"%s\"}", status);*/

    return mqtt.publish(MQTT_STATUS_TOPIC, status);
}

void MQTTManager::publishEvent(const char* payload)
{
    if (!connected())
        return;
    mqtt.publish(MQTT_EVENT_TOPIC, payload);
}