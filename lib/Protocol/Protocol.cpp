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

    if (command == "status")
        return parseStatus(doc, request);

    return false;
}

bool Protocol::parseDispense(JsonDocument& doc, JobRequest& request)
{
    request.type = JobType::Dispense;
    request.actuator = doc["actuator"];
    request.targetWeight = doc["targetWeight"];
    request.speed = doc["speed"] | 1000;
    return true;
}

bool Protocol::parseTare( JsonDocument& doc, JobRequest& request)
{
    request.type = JobType::Tare;
    request.actuator = doc["actuator"];
    return true;
}

bool Protocol::parseStatus( JsonDocument&, JobRequest& request)
{
    request.type = JobType::Status;
    return true;
}

