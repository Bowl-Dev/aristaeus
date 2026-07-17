#pragma once

#include "Config.h"

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