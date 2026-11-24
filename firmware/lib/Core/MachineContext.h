#pragma once

#include <stdint.h>
#include "Calibration.h"
#include "Pins.h"

struct LoadCellState
{
    float weight = 0.0f;
};

struct CommunicationState
{
    bool wifiConnected = false;
    bool mqttConnected = false;

    // Connection-loss counters since boot (diagnostics, see main.cpp).
    uint32_t wifiDrops = 0;
    uint32_t mqttDrops = 0;

    // Longest time one pass of loop() has taken since boot, in ms. A large
    // value means something blocked the main loop (and so MQTT) for that long.
    uint32_t maxLoopMs = 0;
};

struct MachineContext
{
    LoadCellState loadCell[NUM_LOAD_CELLS];
    Calibration calibration[NUM_LOAD_CELLS];
    CommunicationState communication;
};
