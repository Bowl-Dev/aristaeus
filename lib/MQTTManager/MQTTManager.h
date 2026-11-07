#pragma once

#include <WiFiClient.h>
#include <PubSubClient.h>
#include <IPAddress.h>
#include "ITelemetryPublisher.h"

class MachineController;
class Protocol;

class MQTTManager : public ITelemetryPublisher
{
public:

    MQTTManager(MachineController& controller, Protocol& protocol);

    void begin();
    void update();
    bool connected();
    bool publishStatus(const char* status) override;
    bool publishEvent(const char* payload) override;

private:

    void reconnect();
    // Looks up MQTT_BROKER_HOSTNAME via mDNS and updates brokerAddress if it
    // succeeds. On failure, leaves brokerAddress as whatever it already was
    // (the fallback IP, or the last address that DID resolve) rather than
    // clearing it - a single missed multicast packet shouldn't undo a
    // known-good address.
    void resolveBrokerAddress();
    static void mqttCallback(char* topic, uint8_t* payload, unsigned int length);
    void handleMessage(char* topic, uint8_t* payload, unsigned int length);

private:

    MachineController& controller;
    Protocol& protocol;
    WiFiClient wifiClient;
    PubSubClient mqtt;
    uint32_t lastReconnectAttempt = 0;
    IPAddress brokerAddress;
    bool mdnsStarted = false;
    static MQTTManager* instance;
};