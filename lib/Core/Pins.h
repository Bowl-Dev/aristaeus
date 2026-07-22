#pragma once

#include "Config.h"
#include <stdint.h>

constexpr StepperConfig STEP1 =
{
    12,
    14,
    27
};

constexpr StepperConfig STEP2 =
{
    16,
    17,
    18
};

constexpr uint8_t NUM_LOAD_CELLS = 2;
constexpr uint8_t HX711_DT_PIN[NUM_LOAD_CELLS] =
{
    32,
    34
};

constexpr uint8_t HX711_SCK_PIN[NUM_LOAD_CELLS] =
{
    33,
    21
};

constexpr LoadCellConfig SCALE1 =
{
    4,
    16,
    -7050.0f
};

constexpr LoadCellConfig SCALE2 =
{
    36,
    39,
    -7030.0f
};

constexpr ServoConfig SERVO1 =
{
    18,
    500,
    2500
};

constexpr ServoConfig SERVO2 =
{
    19,
    500,
    2500
};