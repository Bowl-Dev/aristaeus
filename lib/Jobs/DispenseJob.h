#pragma once

#include <stdint.h>
#include "MachineState.h"

class MachineServices;


struct DispenseJob
{
    uint8_t actuator = 0;
    float targetWeight = 0.0f;
    uint32_t speed = 1000;
};

namespace Jobs
{
    void beginDispenseJob( DispenseJob& job, MachineServices& services, MachineMode& mode);

    void updateDispenseJob(  DispenseJob& job, MachineServices& services, MachineMode& mode);
}

