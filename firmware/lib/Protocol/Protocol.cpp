#include "Protocol.h"

bool Protocol::parse(const char* json, JobRequest& request)
{
    JsonDocument doc;

    auto error = deserializeJson(doc, json);

    if (error)
        return false;

    String command = doc["command"];

    if (command == "dispense")
        return parseDispense(doc, request);

    if (command == "tare")
        return parseTare(doc, request);

    if (command == "calibrate")
        return parseCalibrate(doc, request);

    if (command == "status")
        return parseStatus(doc, request);
    
    if (command == "reset")
        {
            request.type = JobType::Reset;
            request.actuator = doc["actuator"];
            return true;
        }

    if (command == "resume")
        {
            request.type = JobType::Resume;
            request.actuator = doc["actuator"];
            return true;
        }

    if (command == "gate")
        return parseGate(doc, request);

    if (command == "flush")
    {
        request.type = JobType::Flush;
        request.actuator = doc["actuator"];
        return true;
    }

    return false;
}

bool Protocol::parseDispense(JsonDocument& doc, JobRequest& request)
{
    request.type = JobType::Dispense;
    request.actuator = doc["actuator"];
    request.targetWeight = doc["targetWeight"];
    request.speed = doc["speed"] | 1000;
    request.holdFlush = doc["holdFlush"] | false;
    // Optional command id from the dashboard (0 = none). Lets the firmware
    // recognise a re-sent copy of a command it already accepted.
    request.id = doc["id"] | static_cast<uint32_t>(0);
    return true;
}

bool Protocol::parseTare( JsonDocument& doc, JobRequest& request)
{
    request.type = JobType::Tare;
    request.actuator = doc["actuator"];
    return true;
}

bool Protocol::parseCalibrate(JsonDocument& doc, JobRequest& request)
{
    request.type = JobType::Calibrate;
    request.actuator = doc["actuator"];
    request.targetWeight = doc["knownWeight"];
    return true;
}

bool Protocol::parseStatus( JsonDocument&, JobRequest& request)
{
    request.type = JobType::Status;
    return true;
}

bool Protocol::parseGate(JsonDocument& doc, JobRequest& request)
{
    request.type = JobType::MoveServo;
    request.actuator = doc["actuator"];
    request.openGate = doc["open"] | false;
    return true;
}

