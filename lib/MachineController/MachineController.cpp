#include "MachineController.h"
#include <Arduino.h>

MachineController::MachineController(
    MachineContext& ctx,
    StepperManager& step,
    LoadCellManager& load,
    ServoManager& servo,
    WifiManager& wifiMgr,
    MQTTManager& mqttMgr,
    SafetyManager& safetyMgr)

    : context(ctx),
      stepperManager(step),
      loadCellManager(load),
      servoManager(servo),
      wifiManager(wifiMgr),
      mqttManager(mqttMgr),
      safetyManager(safetyMgr),
      services{
            stepperManager,
            loadCellManager,
            servoManager,
            mqttManager,
            wifiManager,
            safetyManager}
{
}

void MachineController::begin()
{
    wifiManager.begin();
    mqttManager.begin();
    stepperManager.begin();
    loadCellManager.begin();
    servoManager.begin();
    safetyManager.begin();

    context.system.initialized = true;
}

void MachineController::update()
{
    //Serial.println("MachineController::update()");

    wifiManager.update();
    mqttManager.update();
    loadCellManager.update();
    stepperManager.update();
    servoManager.update();
    safetyManager.update();

    if (currentJobType == JobType::None)
    {
        JobRequest request;

        if (jobQueue.dequeue(request))
        {
        switch (request.type)
        {
            case JobType::Dispense:

                dispenseJob.state = JobState::Idle;
                dispenseJob.actuator = request.actuator;
                dispenseJob.targetWeight = request.target;

                Jobs::beginDispenseJob(dispenseJob, services);

                currentJobType = JobType::Dispense;

                break;

                default:
                break;
            }
        }
    }

    switch (currentJobType)
    {
        case JobType::Dispense:

            Jobs::updateDispenseJob(dispenseJob, services);

            break;

            default:
            break;
    }

    if (currentJobType == JobType::Dispense)
    {
        if (dispenseJob.state == JobState::Finished)
        {
            Serial.println("DispenseJob completed");
            currentJobType = JobType::None;
        }
    }

    context.system.uptime++;
}

bool MachineController::enqueueJob(const JobRequest& request)
{
    return jobQueue.enqueue(request);
}