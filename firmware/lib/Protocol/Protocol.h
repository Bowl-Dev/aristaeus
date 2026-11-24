#pragma once

#include "Command.h"

class Protocol
{
public:

    // Parses one MQTT command payload. Returns false on bad JSON or an
    // unknown "command".
    bool parse(const char* json, JobRequest& request);
};
