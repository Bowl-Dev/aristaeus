#pragma once

#include <stdint.h>
#include "Calibration.h"
#include "Pins.h"

struct StepperState
{
    bool enabled = false;
    bool running = false;
    float speed = 0.0f;
    bool direction = false;
};

struct LoadCellState
{
    int32_t raw = 0;
    float weight = 0.0f;
    bool stable = false;
    bool connected = false;
    bool tareComplete = false;    
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

    Calibration calibration[NUM_LOAD_CELLS];

    CommunicationState communication;
    SystemState system;
};