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
    94,      // closedAngle
    20      // openAngle
};

constexpr ServoConfig SERVO2 =
{
    13,
    500,
    2500,
    88,
    20
};

constexpr uint32_t FLUSH_DURATION_MS = 1000;