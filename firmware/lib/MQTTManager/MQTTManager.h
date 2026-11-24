#pragma once

#include <WiFiClient.h>
#include <PubSubClient.h>
#include <IPAddress.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <freertos/task.h>
#include "ITelemetryPublisher.h"

class MachineController;
class Protocol;

// All network I/O (WiFi MQTT connect/reconnect, mDNS lookup, publish, receive)
// runs in its own FreeRTOS task on core 0. Those calls can block for many
// seconds when the WiFi link misbehaves (a TCP write that never gets ACKed
// retries for up to 10 s), and when they ran in loop() they froze the
// dispensing control - gates, weight monitoring, stepper handling - for that
// long. Now loop() (core 1) only ever touches thread-safe queues:
//
//   control loop --publishStatus/publishEvent--> queues --> network task --> broker
//   broker --> network task --> command queue --update()--> control loop
//
// The MQTT client object itself is used ONLY by the network task. Commands
// are still executed on the control loop's thread, exactly as before.
class MQTTManager : public ITelemetryPublisher
{
public:

    MQTTManager(MachineController& controller, Protocol& protocol);

    void begin();

    // Control-loop side: runs commands received by the network task.
    void update();

    bool connected();

    // PubSubClient connection state code (diagnostics): -4 timeout,
    // -3 connection lost, -2 connect failed, -1 disconnected, 0 connected,
    // 1..5 broker refused (bad protocol / client id / unavailable / ...).
    int lastState() { return mqttState; }

    // Non-blocking: queue the message for the network task. Status keeps only
    // the newest message (an old status is worthless); events are queued in
    // order and the oldest wait if the link is down.
    bool publishStatus(const char* status) override;
    bool publishEvent(const char* payload) override;

private:

    static constexpr size_t STATUS_MAX = 900;
    static constexpr size_t EVENT_MAX = 160;
    static constexpr size_t COMMAND_MAX = 256;

    struct CommandMsg
    {
        char json[COMMAND_MAX];
    };

    // --- network task side ---
    static void networkTaskEntry(void* arg);
    void networkLoop();
    void reconnect();
    // Looks up MQTT_BROKER_HOSTNAME via mDNS and updates brokerAddress if it
    // succeeds. On failure, leaves brokerAddress as whatever it already was
    // (the fallback IP, or the last address that DID resolve) rather than
    // clearing it - a single missed multicast packet shouldn't undo a
    // known-good address.
    void resolveBrokerAddress();
    static void mqttCallback(char* topic, uint8_t* payload, unsigned int length);
    void enqueueCommand(const uint8_t* payload, unsigned int length);

    // --- control loop side ---
    void processCommand(const char* json);

private:

    MachineController& controller;
    Protocol& protocol;
    WiFiClient wifiClient;
    PubSubClient mqtt;          // touched only by the network task
    uint32_t lastReconnectAttempt = 0;
    IPAddress brokerAddress;
    bool mdnsStarted = false;

    QueueHandle_t statusQueue = nullptr;    // length 1, overwritten with newest
    QueueHandle_t eventQueue = nullptr;
    QueueHandle_t commandQueue = nullptr;

    volatile bool mqttUp = false;
    volatile int mqttState = -1;

    static MQTTManager* instance;
};
