#include "MQTTEventListener.h"
#include <ArduinoJson.h>

MQTTEventListener::MQTTEventListener(ITelemetryPublisher& telemetryPublisher)
: telemetry(telemetryPublisher)
{
}

void MQTTEventListener::onMachineEvent(const MachineEvent& event)
{
    JsonDocument doc;
    
    doc["device"] = DEVICE_ID;
    doc["actuator"] = event.actuator;
    doc["event"] = eventToString(event.type);
    doc["timestamp"] = event.timestamp;

    char payload[128];

    serializeJson(doc, payload);

    telemetry.publishEvent(payload);    
}