#include "MQTTEventListener.h"
#include <ArduinoJson.h>

namespace
{
const char* eventToString(MachineEventType type)
{
    switch (type)
    {
        case MachineEventType::JobAccepted:
            return "JobAccepted";

        case MachineEventType::JobStarted:
            return "JobStarted";

        case MachineEventType::JobFinished:
            return "JobFinished";

        case MachineEventType::JobRejected:
            return "JobRejected";

        case MachineEventType::EmergencyStop:
            return "EmergencyStop";

        case MachineEventType::Error:
            return "Error";

        case MachineEventType::ErrorCleared:
            return "ErrorCleared";

        default:
            return "Unknown";
    }
}
}

MQTTEventListener::MQTTEventListener(ITelemetryPublisher& telemetryPublisher)
: telemetry(telemetryPublisher)
{
}

void MQTTEventListener::onMachineEvent(const MachineEvent& event)
{
    JsonDocument doc;
    
    doc["device"] = DEVICE_ID;
    doc["event"] = eventToString(event.type);
    doc["timestamp"] = event.timestamp;

    char payload[128];

    serializeJson(doc, payload);

    telemetry.publishEvent(payload);    
}