#pragma once

#include "MachineContext.h"

#include "StepperManager.h"
#include "LoadCellManager.h"
#include "ServoManager.h"
#include "WifiManager.h"
#include "MQTTManager.h"
#include "SafetyManager.h"
#include "MachineServices.h"
#include "JobQueue.h"
#include "DispenseJob.h"

class MachineController
{
public:

    MachineController(
        MachineContext& context,
        StepperManager& steppers,
        LoadCellManager& loadCells,
        ServoManager& servos,
        WifiManager& wifi,
        MQTTManager& mqtt,
        SafetyManager& safety);

    void begin();

    void update();

    bool enqueueJob(const JobRequest& request);

private:

    MachineContext& context;

    StepperManager& stepperManager;
    LoadCellManager& loadCellManager;
    ServoManager& servoManager;
    WifiManager& wifiManager;
    MQTTManager& mqttManager;
    SafetyManager& safetyManager;
    MachineServices services;
    JobQueue jobQueue;
    JobType currentJobType = JobType::None;
    DispenseJob dispenseJob;
};