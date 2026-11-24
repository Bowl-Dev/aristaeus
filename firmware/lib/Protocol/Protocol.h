#pragma once

#include "Command.h"
#include <ArduinoJson.h>

class Protocol
{
public:

    bool parse(
        const char* json,
        JobRequest& request);

private:

    bool parseDispense(
        JsonDocument& doc,
        JobRequest& request);

    bool parseTare(
        JsonDocument& doc,
        JobRequest& request);

    bool parseCalibrate(
        JsonDocument& doc,
        JobRequest& request);

    bool parseStatus(
        JsonDocument& doc,
        JobRequest& request);

    bool parseGate(
        JsonDocument& doc,
        JobRequest& request);
};