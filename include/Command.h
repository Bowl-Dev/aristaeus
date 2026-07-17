#pragma once

#include <stdint.h>

enum class CommandType
{
    None,

    Ping,

    Tare,

    Calibrate,

    EnableStepper,

    DisableStepper,

    StartStepper,

    StopStepper,

    SetStepperSpeed,

    SetServo,

    EmergencyStop,

    Reboot
};

struct Command
{
    CommandType type = CommandType::None;

    uint8_t target = 0;

    int32_t value = 0;

    float valueFloat = 0.0f;

    bool flag = false;

    uint32_t timestamp = 0;
};