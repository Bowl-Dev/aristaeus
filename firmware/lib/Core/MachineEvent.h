//Machine communication

#pragma once
#include <Arduino.h>

enum class MachineEventType
{
    JobAccepted,
    JobStarted,
    JobFinished,
    JobRejected,

    Error,
    ErrorCleared
};

struct MachineEvent
{
    MachineEventType type;
    uint8_t actuator = 0;
    uint32_t timestamp;
};

inline const char* eventToString(MachineEventType type)
{
    switch (type)
    {
        case MachineEventType::JobAccepted:  return "JobAccepted";
        case MachineEventType::JobStarted:   return "JobStarted";
        case MachineEventType::JobFinished:  return "JobFinished";
        case MachineEventType::JobRejected:  return "JobRejected";
        case MachineEventType::Error:        return "Error";
        case MachineEventType::ErrorCleared: return "ErrorCleared";
        default:                             return "Unknown";
    }
}