#include "SerialEventListener.h"
#include <Arduino.h>

void SerialEventListener::onMachineEvent(const MachineEvent& event)
{
    Serial.print("[EVENT] actuator ");
    Serial.print(event.actuator);
    Serial.print(": ");
    Serial.println(eventToString(event.type));
}
