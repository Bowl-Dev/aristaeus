#include "Protocol.h"
#include <ArduinoJson.h>
#include <string.h>

bool Protocol::parse(const char* json, JobRequest& request)
{
    JsonDocument doc;

    if (deserializeJson(doc, json))
        return false;

    const char* command = doc["command"] | "";
    request.actuator = doc["actuator"];

    if (!strcmp(command, "dispense"))
    {
        request.type = JobType::Dispense;
        request.targetWeight = doc["targetWeight"];
        request.speed = doc["speed"] | 1000;
        request.holdFlush = doc["holdFlush"] | false;
        // Optional command id from the dashboard (0 = none). Lets the firmware
        // recognise a re-sent copy of a command it already accepted.
        request.id = doc["id"] | static_cast<uint32_t>(0);
    }
    else if (!strcmp(command, "calibrate"))
    {
        request.type = JobType::Calibrate;
        request.targetWeight = doc["knownWeight"];
    }
    else if (!strcmp(command, "gate"))
    {
        request.type = JobType::MoveServo;
        request.openGate = doc["open"] | false;
    }
    else if (!strcmp(command, "tare"))   request.type = JobType::Tare;
    else if (!strcmp(command, "reset"))  request.type = JobType::Reset;
    else if (!strcmp(command, "resume")) request.type = JobType::Resume;
    else if (!strcmp(command, "flush"))  request.type = JobType::Flush;
    else return false;

    return true;
}
