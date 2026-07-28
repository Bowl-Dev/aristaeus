#include "MQTTManager.h"
#include "Protocol.h"
#include "Config.h"
#include <WiFi.h>
//#include "MachineController.h"

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

    Serial.print("Payload: ");

    for (unsigned int i = 0; i < length; i++)
        Serial.print((char)payload[i]);

    Serial.println();
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
}