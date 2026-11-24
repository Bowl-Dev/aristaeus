#pragma once

#include <stdint.h>

enum class CommandType
{
    None,

    Ping,

    Dispense,

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
    Status,
    MoveServo,
    Reset,
    Resume,
    Calibrate,
    Flush       // opens the gate of an actuator parked in WaitingToFlush (holdFlush jobs)
};

struct JobRequest
{
    uint32_t id = 0;
    JobType type = JobType::None;
    uint8_t actuator = 0;

    // For Dispense: target weight to dispense, in grams.
    // For Calibrate: the known reference weight currently on the tray, in
    // grams - reused rather than adding a dedicated field, same as every
    // other JobType that only cares about a subset of these.
    float targetWeight = 0.0f;

    uint32_t speed = 1000;

    // For MoveServo: true to open the gate, false to close it. Manual,
    // on-demand control for clearing a jam or cleaning - independent of any
    // dispense job (rejected while one is actively running on this
    // actuator).
    bool openGate = false;

    // For Dispense: when true, after reaching the target weight the actuator
    // parks in WaitingToFlush and does NOT flush on its own - not even via
    // the automatic synchronized flush - until a Flush command arrives. Used
    // by the dashboard to flush several dispensers (possibly on different
    // ESP32s) at the exact same moment, on the operator's command.
    bool holdFlush = false;
};