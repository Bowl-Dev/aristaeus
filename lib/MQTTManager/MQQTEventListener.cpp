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

MQTTEventListener::MQTTEventListener(MQTTManager& mqtt)
: mqttManager(mqtt)
{
}

void MQTTEventListener::onMachineEvent(const MachineEvent& event)
{
    JsonDocument doc;
    
    doc["event"] = eventToString(event.type);
    doc["timestamp"] = event.timestamp;

    char payload[128];

    serializeJson(doc, payload);

    mqttManager.publishEvent(payload);
    /*switch(event.type)
    {
         case MachineEventType::JobAccepted:
            doc["event"] = "JobAccepted";
            break;

        case MachineEventType::JobStarted:
            doc["event"] = "JobStarted";
            break;

        case MachineEventType::JobFinished:
            doc["event"] = "JobFinished";
            break;

        case MachineEventType::JobRejected:
            doc["event"] = "JobRejected";
            break;

        case MachineEventType::EmergencyStop:
            doc["event"] = "EmergencyStop";
            break;

        case MachineEventType::Error:
            doc["event"] = "Error";
            break;

        case MachineEventType::ErrorCleared:
            doc["event"] = "ErrorCleared";
            break;

        default:
            return;
    }
    
    doc["timestamp"] = event.timestamp;

    char buffer[128];
    serializeJson(doc, buffer);

    mqttManager.publishEvent(buffer);*/
}