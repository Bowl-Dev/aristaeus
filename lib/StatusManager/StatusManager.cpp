#include "StatusManager.h"
#include <Arduino.h>
#include <ArduinoJson.h>

namespace
{

const char* modeToString(MachineMode mode)
{
    switch (mode)
    {
        case MachineMode::Booting:
            return "Booting";

        case MachineMode::Initializing:
            return "Initializing";

        case MachineMode::Ready:
            return "Ready";

        case MachineMode::Dispensing:
            return "Dispensing";
        
        case MachineMode::Flushing:
            return "Flushing";

        case MachineMode::Paused:
            return "Paused";        

        case MachineMode::Error:
            return "Error";

        case MachineMode::EmergencyStop:
            return "EmergencyStop";

        default:
            return "Unknown";
    }
}
}

StatusManager::StatusManager(MachineContext& ctx, MachineController& ctrl, ITelemetryPublisher& telemetryPublisher)
    : context(ctx),
    controller(ctrl),
    telemetry(telemetryPublisher)
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
    doc["lastError"] = state.lastError;
    doc["uptime"] = state.uptime;
    doc["queuedJobs"] = state.queuedJobs;

    // Communication state comes from MachineContext
    doc["wifi"] = context.communication.wifiConnected;
    doc["mqtt"] = context.communication.mqttConnected;

    // Optional hardware information
    doc["loadCell0"] = context.loadCell[0].weight;
    doc["loadCell1"] = context.loadCell[1].weight;

    JsonObject job = doc.createNestedObject("job");

    job["id"] = state.activeJob.id;
    job["active"] = state.activeJob.active;
    job["actuator"] = state.activeJob.actuator;
    job["targetWeight"] = state.activeJob.targetWeight;
    job["currentWeight"] = state.activeJob.currentWeight;
    job["progress"] = state.activeJob.progress;

    char payload[400];

    serializeJson(doc, payload);
    telemetry.publishStatus(payload);
    
}