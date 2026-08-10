#include "SerialEventListener.h"
#include <Arduino.h>

void SerialEventListener::onMachineEvent(const MachineEvent& event)
{
    Serial.print("[EVENT] actuator ");
    Serial.print(event.actuator);
    Serial.print(": ");

    switch(event.type)
    {
        case MachineEventType::JobAccepted:
            Serial.println("[EVENT] JobAccepted");
            break;

        case MachineEventType::JobStarted:
            Serial.println("[EVENT] JobStarted");
            break;

        case MachineEventType::JobFinished:
            Serial.println("[EVENT] JobFinished");
            break;

        case MachineEventType::JobRejected:
            Serial.println("[EVENT] JobRejected");
            break;
            
        case MachineEventType::EmergencyStop:
            Serial.println("[EVENT] EmergencyStop");
            break;

        case MachineEventType::Error:
            Serial.println("[EVENT] Error");
            break;

        case MachineEventType::ErrorCleared:
            Serial.println("[EVENT] ErrorCleared");
            break;

        default:
            Serial.println("Unknown");
            break;
    }
}


