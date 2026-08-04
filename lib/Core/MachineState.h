#pragma once

enum class MachineMode
{
    Booting,
    Initializing,
    Ready,
    Running,
    Finished,
    Paused,
    Error,
    EmergencyStop
};

struct MachineState
{
    MachineMode mode = MachineMode::Booting;

    uint32_t uptime = 0;

    uint16_t queuedJobs = 0;

    bool wifiConnected = false;

    bool mqttConnected = false;
};