#include "StatusManager.h"
#include <Arduino.h>
#include <ArduinoJson.h>
#include <WiFi.h>
#include <esp_system.h>

const char* resetReasonToString()
{
    switch (esp_reset_reason())
    {
        case ESP_RST_POWERON:   return "PowerOn";
        case ESP_RST_EXT:       return "ExternalPin";
        case ESP_RST_SW:        return "Software";
        case ESP_RST_PANIC:     return "Panic";
        case ESP_RST_INT_WDT:   return "IntWDT";
        case ESP_RST_TASK_WDT:  return "TaskWDT";
        case ESP_RST_WDT:       return "WDT";
        case ESP_RST_DEEPSLEEP: return "DeepSleep";
        case ESP_RST_BROWNOUT:  return "Brownout";
        default:                return "Unknown";
    }
}

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

        case MachineMode::WaitingToFlush:
            return "WaitingToFlush";

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

    // Diagnostics for tracking down devices that keep dropping offline.
    // Protocol version 2: dispense commands carry an id and repeats are
    // deduplicated, so the dashboard may safely re-send until acknowledged.
    doc["proto"] = 2;
    doc["reset"] = resetReasonToString();
    doc["mac"] = WiFi.macAddress();   // two boards flashed with the same DEVICE_ID show up as one device with alternating MACs
    doc["rssi"] = WiFi.RSSI();
    doc["heap"] = ESP.getFreeHeap();
    doc["wifiDrops"] = context.communication.wifiDrops;
    doc["mqttDrops"] = context.communication.mqttDrops;
    doc["maxLoopMs"] = context.communication.maxLoopMs;

    // Keys are suffixed per actuator (mode0, job0, ...) - dashboard.py reads them.
    for (uint8_t i = 0; i < NUM_LOAD_CELLS; i++)
    {
        const ActuatorState& a = state.actuator[i];
        String n(i);

        doc["mode" + n] = modeToString(a.mode);
        doc["lastError" + n] = a.lastError;
        doc["queuedJobs" + n] = a.queuedJobs;
        doc["loadCell" + n] = context.loadCell[i].weight;
        doc["calibration" + n] = context.calibration[i].countsPerGram;
        doc["ingredient" + n] = INGREDIENT_NAMES[i];

        JsonObject job = doc["job" + n].to<JsonObject>();
        job["id"] = a.activeJob.id;
        job["active"] = a.activeJob.active;
        job["targetWeight"] = a.activeJob.targetWeight;
        job["currentWeight"] = a.activeJob.currentWeight;
        job["progress"] = a.activeJob.progress;
    }

    // Must stay below the MQTT client buffer (1024, see MQTTManager::begin)
    // minus topic/header, or the message is silently dropped.
    char payload[900];

    serializeJson(doc, payload);
    telemetry.publishStatus(payload);
}
