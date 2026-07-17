#pragma once

enum class MachineMode
{
    Booting,

    Initializing,

    Ready,

    Running,

    Paused,

    Error,

    EmergencyStop
};

struct MachineState
{
    MachineMode mode = MachineMode::Booting;
};