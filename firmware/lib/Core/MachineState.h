#pragma once
#include <string>
#include "Pins.h"

enum class MachineMode //per actuator value
{
    Ready,
    Dispensing,
    WaitingToFlush,   // synchronized-flush units only: target reached, motor
                       // stopped, gate held closed until every actuator that
                       // was actively dispensing has also finished
    Flushing,
    Error,
};

struct ActiveJobState
{
    bool active = false;
    uint32_t id = 0;
    uint8_t actuator = 0;
    float targetWeight = 0.0f;
    float currentWeight = 0.0f;
    uint8_t progress = 0;
    float lastProgressWeight = 0.0f;
    uint32_t lastProgressTime = 0;
};

struct ActuatorState
{
    MachineMode mode = MachineMode::Ready;
    uint16_t queuedJobs = 0;
    ActiveJobState activeJob;
    std::string lastError;
};

struct MachineState
{
    uint32_t uptime = 0;
    ActuatorState actuator[NUM_LOAD_CELLS];
};