#include "DispenseJob.h"
#include "MachineServices.h"
#include "StepperManager.h"
#include "LoadCellManager.h"
#include "ServoManager.h"
#include "Config.h"
#include <Arduino.h>

namespace Jobs
{

void beginDispenseJob(DispenseJob& job, MachineServices& services, MachineMode& mode)
{
    Serial.println("DispenseJob: Starting");
    Serial.print("Initial weight = ");
    Serial.println(services.loadCell.getWeight(job.actuator));

    services.stepper.enable(job.actuator);
    services.stepper.setDirection(job.actuator, true);
    services.stepper.setSpeed(job.actuator, job.speed);
    services.stepper.start(job.actuator);

    mode = MachineMode::Dispensing;
}
}

void Jobs::updateDispenseJob(DispenseJob& job, MachineServices& services, MachineMode& mode)
{
    switch (mode)
    {
        case MachineMode::Dispensing:
        {
            float weight = services.loadCell.getWeight(job.actuator);

            if (weight >= job.targetWeight*0.90)
            {
                services.stepper.setSpeed(job.actuator, job.speed*0.4);
            }

            if (weight >= (job.targetWeight-3))
            {
                services.stepper.stop(job.actuator);
                services.stepper.disable(job.actuator);

                if (SYNCHRONIZED_FLUSH || job.holdFlush)
                {
                    // Motor's done, but the gate stays closed until every
                    // actuator that's actively dispensing has also reached
                    // its target - MachineController::synchronizeFlush()
                    // opens them all together once that's true.
                    Serial.println("Target reached, waiting to flush with sibling actuator(s)");
                    mode = MachineMode::WaitingToFlush;
                }
                else
                {
                    Serial.println("Target reached, opening gate");
                    services.servo.openGate(job.actuator);
                    mode = MachineMode::Flushing;
                }
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
