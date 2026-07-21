#pragma once

#include <stdint.h>

enum class JobState : uint8_t
{
    Idle,

    Starting,

    Running,

    Finishing,

    Finished,

    Error
};