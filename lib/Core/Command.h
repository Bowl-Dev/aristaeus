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
    SetStepperDirection,

    SetServoPosition,

    EmergencyStop,

    Reset,

    Reboot
};

enum class DeviceType
{
    None,
    Stepper,
    LoadCell,
    Servo,
    System
};

struct Command
{
    CommandType type = CommandType::None;
    DeviceType device = DeviceType::None;
    uint8_t target = 0;
    int32_t value = 0;
    float valueFloat = 0.0f;
    bool flag = false;
    uint32_t timestamp = 0;
};

enum class JobType : uint8_t
{
    None = 0,
    Dispense,
    Tare,
    MoveServo,
    Stop
};

struct JobRequest
{
    JobType type = JobType::None;
    uint8_t actuator = 0;
    float target = 0.0f;
};