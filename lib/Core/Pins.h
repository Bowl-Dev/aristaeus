#pragma once

#include "Config.h"
#include <stdint.h>

constexpr StepperConfig STEP1 =
{
    16,
    17,
    18//12,
    //14,
    //27
};

constexpr StepperConfig STEP2 =
{
    12, //16,
    14, //17,
    27 //18
};

constexpr uint8_t NUM_LOAD_CELLS = 2;
constexpr uint8_t HX711_DT_PIN[NUM_LOAD_CELLS] =
{
    34, //32,
    32, //34
};

constexpr uint8_t HX711_SCK_PIN[NUM_LOAD_CELLS] =
{
    21, //33,
    33, //21
};

constexpr ServoConfig SERVO1 =
{
    26,
    500,
    2500,
    89,      // closedAngle
    30      // openAngle
};

constexpr ServoConfig SERVO2 =
{
    13,
    500,
    2500,
    89,
    30
};

constexpr uint32_t FLUSH_DURATION_MS = 1000;

// Gates used to snap straight to their target angle (as fast as the servo's
// own hardware allows) - now ServoManager ramps one degree at a time, this
// many milliseconds apart. Started at 5ms/degree as roughly half that
// original speed; raise it further to slow the gates down more, lower it
// (toward 0) to speed them back up toward the old instant-snap behavior.
constexpr uint32_t SERVO_STEP_INTERVAL_MS = 5;

// After a gate reaches its target, wait this long (so the servo physically
// finishes travelling) and then stop sending it pulses entirely, which
// prevents idle hunting/jitter. NOTE: an unpowered-signal servo no longer
// holds position, so the gate must stay put on its own.
constexpr uint32_t SERVO_RELEASE_DELAY_MS = 400;