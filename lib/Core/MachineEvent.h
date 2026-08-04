//Machine communication

#pragma once
#include <Arduino.h>

enum class MachineEventType
{
    JobAccepted,
    JobStarted,
    JobFinished,
    JobRejected,

    EmergencyStop,
    Error,
    ErrorCleared
};

struct MachineEvent
{
    MachineEventType type;
    uint32_t timestamp;
};