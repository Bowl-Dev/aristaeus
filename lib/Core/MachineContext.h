#pragma once

#include <stdint.h>

struct StepperState
{
    bool enabled = false;
    bool running = false;
    float speed = 0.0f;
    bool direction = false;
};

struct LoadCellState
{
    float weight = 0.0f;
};

struct ServoState
{
    float position = 0.0f;
};

struct CommunicationState
{
    bool wifiConnected = false;
    bool mqttConnected = false;
};

struct SystemState
{
    bool initialized = false;
    bool emergencyStop = false;
    uint32_t uptime = 0;
};

struct MachineContext
{
    StepperState stepper[2];
    LoadCellState loadCell[2];
    ServoState servo[2];

    CommunicationState communication;
    SystemState system;
};