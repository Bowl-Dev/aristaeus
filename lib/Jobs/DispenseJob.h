#pragma once

#include <stdint.h>
#include <JobState.h>

class MachineServices;


struct DispenseJob
{
    JobState state = JobState::Idle;
    uint8_t actuator = 0;
    float targetWeight = 0.0f;
    uint32_t speed = 1000;
};

namespace Jobs
{
    void beginDispenseJob( DispenseJob& job, MachineServices& services);

    void updateDispenseJob(  DispenseJob& job, MachineServices& services);
}

