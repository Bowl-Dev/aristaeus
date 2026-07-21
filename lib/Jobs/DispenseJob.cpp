#include "DispenseJob.h"
#include "MachineServices.h"
#include "StepperManager.h"
#include "LoadCellManager.h"
#include <arduino.h>

namespace Jobs
{

void beginDispenseJob(
    DispenseJob& job,
    MachineServices& services)
{
    (void)services;   // suppress unused parameter warning
    job.state = JobState::Starting;
}
}

void Jobs::updateDispenseJob(
    DispenseJob& job,
    MachineServices& services)
{
    switch(job.state)
    {
        case JobState::Idle:
            break;

        case JobState::Starting:
            Serial.println("DispenseJob: Starting");
            Serial.print("Initial weight = ");
            Serial.println(services.loadCell.getWeight(job.actuator));
            services.stepper.enable(job.actuator);
            services.stepper.setDirection(job.actuator, true);
            services.stepper.setSpeed(job.actuator, job.speed);
            services.stepper.start(job.actuator);
            job.state = JobState::Running;
            break;

        case JobState::Running:
           {
            float weight = services.loadCell.getWeight(job.actuator);

            Serial.print("Weight = ");
            Serial.println(weight);
            Serial.print("Target = ");
            Serial.println(job.targetWeight);

            if(weight >= job.targetWeight)
                {
                    Serial.println("Target reached");
                    job.state = JobState::Finishing;
                }

             break;
           }
        case JobState::Finishing:
            Serial.println("DispenseJob: Finishing");
            services.stepper.stop(job.actuator);
            services.stepper.disable(job.actuator);
            job.state = JobState::Finished;
            break;

        case JobState::Finished:
            //Serial.println("DispenseJob: Finished");
            break;

        case JobState::Error:
            break;
    }
}