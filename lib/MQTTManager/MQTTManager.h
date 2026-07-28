#pragma once

#include <WiFiClient.h>
#include <PubSubClient.h>

class MachineController;
class Protocol;

class MQTTManager
{
public:

    MQTTManager(MachineController& controller, Protocol& protocol);

    void begin();
    void update();
    bool connected();

private:

    void reconnect();

    static void mqttCallback(char* topic, uint8_t* payload, unsigned int length);

    void handleMessage(char* topic, uint8_t* payload, unsigned int length);

private:

    MachineController& controller;
    Protocol& protocol;
    WiFiClient wifiClient;
    PubSubClient mqtt;
    uint32_t lastReconnectAttempt = 0;
    static MQTTManager* instance;
};