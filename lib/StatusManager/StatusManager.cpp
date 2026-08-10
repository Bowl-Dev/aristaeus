#include "StatusManager.h"
#include <Arduino.h>
#include <ArduinoJson.h>

namespace
{

const char* modeToString(MachineMode mode)
{
    switch (mode)
    {
        case MachineMode::Ready:
            return "Ready";

        case MachineMode::Dispensing:
            return "Dispensing";
        
        case MachineMode::Flushing:
            return "Flushing";       

        case MachineMode::Error:
            return "Error";        

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

    doc["device"] = DEVICE_ID;
    doc["uptime"] = state.uptime;
    doc["wifi"] = context.communication.wifiConnected;
    doc["mqtt"] = context.communication.mqttConnected;

    doc["mode0"] = modeToString(state.actuator[0].mode);
    doc["lastError0"] = state.actuator[0].lastError;
    doc["queuedJobs0"] = state.actuator[0].queuedJobs;
    doc["loadCell0"] = context.loadCell[0].weight;
    doc["ingredient0"] = INGREDIENT_NAMES[0];

    JsonObject job0 = doc.createNestedObject("job0");
    job0["id"] = state.actuator[0].activeJob.id;
    job0["active"] = state.actuator[0].activeJob.active;
    job0["targetWeight"] = state.actuator[0].activeJob.targetWeight;
    job0["currentWeight"] = state.actuator[0].activeJob.currentWeight;
    job0["progress"] = state.actuator[0].activeJob.progress;

    doc["mode1"] = modeToString(state.actuator[1].mode);
    doc["lastError1"] = state.actuator[1].lastError;
    doc["queuedJobs1"] = state.actuator[1].queuedJobs;
    doc["loadCell1"] = context.loadCell[1].weight;
    doc["ingredient1"] = INGREDIENT_NAMES[1];

    JsonObject job1 = doc.createNestedObject("job1");
    job1["id"] = state.actuator[1].activeJob.id;
    job1["active"] = state.actuator[1].activeJob.active;
    job1["targetWeight"] = state.actuator[1].activeJob.targetWeight;
    job1["currentWeight"] = state.actuator[1].activeJob.currentWeight;
    job1["progress"] = state.actuator[1].activeJob.progress;

    char payload[600];

    size_t len = serializeJson(doc, payload);

    bool ok = telemetry.publishStatus(payload);

    /*Serial.print("StatusManager publish: ");
    Serial.print(ok ? "OK" : "FAILED");
    Serial.print(" (");
    Serial.print(len);
    Serial.println(" bytes)");*/
}