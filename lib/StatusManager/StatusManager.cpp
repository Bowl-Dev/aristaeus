#include "StatusManager.h"
#include <Arduino.h>
#include <ArduinoJson.h>

//#define MQTT_MAX_PACKET_SIZE 512

namespace
{

const char* modeToString(MachineMode mode)
{
    switch (mode)
    {
        case MachineMode::Booting:
            return "Booting";

        case MachineMode::Ready:
            return "Ready";

        case MachineMode::Running:
            return "Running";

        case MachineMode::Paused:
            return "Paused";

        case MachineMode::Finished:
            return "Finished";

        case MachineMode::Error:
            return "Error";

        case MachineMode::EmergencyStop:
            return "EmergencyStop";

        default:
            return "Unknown";
    }
}
}

StatusManager::StatusManager(MachineContext& ctx, MachineController& ctrl, MQTTManager& mqtt)
    : context(ctx),
    controller(ctrl),
    mqttManager(mqtt)
{
}

void StatusManager::begin()
{
}

void StatusManager::update()
{
    uint32_t now = millis();

    if (now - lastPublish < 1000)
        return;

    lastPublish = now;

    const MachineState& state = controller.state();

    JsonDocument doc;

    doc["mode"] = modeToString(state.mode);
    doc["uptime"] = state.uptime;
    doc["queuedJobs"] = state.queuedJobs;

    // Communication state comes from MachineContext
    doc["wifi"] = context.communication.wifiConnected;
    doc["mqtt"] = context.communication.mqttConnected;

    // Optional hardware information
    doc["loadCell0"] = context.loadCell[0].weight;
    doc["loadCell1"] = context.loadCell[1].weight;

    char payload[256];

    serializeJson(doc, payload);
    mqttManager.publishStatus(payload);

    /*Serial.print("JSON length = ");
    Serial.println(strlen(payload));
    Serial.println(payload);*/
}