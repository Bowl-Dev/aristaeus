#pragma once
#include <string>

enum class MachineMode
{
    Booting,
    Initializing,
    Ready,
    Dispensing,
    Flushing,       
    Error,
    EmergencyStop,
    Paused
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

struct MachineState
{
    MachineMode mode = MachineMode::Booting;
    uint32_t uptime = 0;
    uint16_t queuedJobs = 0;
    bool wifiConnected = false;
    bool mqttConnected = false;
    ActiveJobState activeJob;
    std::string lastError;
};