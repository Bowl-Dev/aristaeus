#pragma once

#include "MachineContext.h"
#include "MachineState.h"
#include "MachineEvent.h"
#include "MachineEventListener.h"

#include "StepperManager.h"
#include "LoadCellManager.h"
#include "ServoManager.h"
#include "WifiManager.h"
#include "SafetyManager.h"
#include "MachineServices.h"
#include "JobQueue.h"
#include "DispenseJob.h"

constexpr float MIN_PROGRESS = 1.0f;
constexpr uint32_t STALL_TIMEOUT_MS = 20000;

class MachineController
{
public:

    MachineController(
        MachineContext& context,
        StepperManager& steppers,
        LoadCellManager& loadCells,
        ServoManager& servos,
        WifiManager& wifi,        
        SafetyManager& safety);

    void begin();
    void update();
    bool enqueueJob(const JobRequest& request);
    const MachineState& state() const;
    bool executeCommand(const Command& command);
    bool processJobRequest(const JobRequest& request);
    void setEventListener(MachineEventListener* listener);
    
private:

    MachineContext& context;

    StepperManager& stepperManager;
    LoadCellManager& loadCellManager;
    ServoManager& servoManager;
    WifiManager& wifiManager;    
    SafetyManager& safetyManager;
    MachineServices services;
    JobQueue jobQueue;
    JobType currentJobType = JobType::None;
    DispenseJob dispenseJob;
    MachineState currentState;
    MachineEventListener* eventListener = nullptr;
    
    uint32_t nextJobId = 0;

    void setMode(MachineMode mode);
    bool canAcceptJob(const JobRequest& request) const;
    void startNextJob();
    void updateCurrentJob();
    void finishCurrentJob();
    void initializeDispenseJob(const JobRequest& request);
    void jobStarted();
    void jobFinished();
    void jobAccepted(const JobRequest& request);
    void jobRejected(const char* reason);
    void emitEvent(MachineEventType event);
    void resetMachine();     
};