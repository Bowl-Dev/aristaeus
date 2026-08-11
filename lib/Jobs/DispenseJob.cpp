#include "DispenseJob.h"
#include "MachineServices.h"
#include "StepperManager.h"
#include "LoadCellManager.h"
#include "ServoManager.h"
#include <arduino.h>

namespace Jobs
{

void beginDispenseJob(DispenseJob& job, MachineServices& services, MachineMode& mode)
{
    Serial.println("DispenseJob: Starting");
    Serial.print("Initial weight = ");
    Serial.println(services.loadCell.getWeight(job.actuator));

    services.stepper.enable(job.actuator);
    services.stepper.setDirection(job.actuator, false);
    services.stepper.setSpeed(job.actuator, job.speed);
    services.stepper.start(job.actuator);

    mode = MachineMode::Dispensing;
    
    /*(void)services;   // suppress unused parameter warning
    job.state = JobState::Starting;*/
}
}

void Jobs::updateDispenseJob(DispenseJob& job, MachineServices& services, MachineMode& mode)
{
    switch (mode)
    {
        case MachineMode::Dispensing:
        {
            float weight = services.loadCell.getWeight(job.actuator);

            if (weight >= job.targetWeight)
            {
                Serial.println("Target reached, opening gate");

                services.stepper.stop(job.actuator);
                services.stepper.disable(job.actuator);

                services.servo.openGate(job.actuator);
                mode = MachineMode::Flushing;
            }
            break;
        }

        case MachineMode::Flushing:
        {
            if (!services.servo.isFlushing(job.actuator))
            {
                Serial.println("Flush complete, closing gate");

                services.servo.closeGate(job.actuator);
                mode = MachineMode::Ready;
            }
            break;
        }

        default:
            break;
    }
}
    
    /*switch(job.state)
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
            break;

        case JobState::Error:
            break;
    }
}*/