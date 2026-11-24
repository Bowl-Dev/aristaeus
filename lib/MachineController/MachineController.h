#pragma once

#include "MachineContext.h"
#include "MachineState.h"
#include "MachineEvent.h"
#include "MachineEventListener.h"
#include "Pins.h"

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

    JobQueue jobQueue[NUM_LOAD_CELLS];    
    DispenseJob dispenseJob[NUM_LOAD_CELLS];

    MachineState currentState;
    MachineEventListener* eventListener = nullptr;
    
    uint32_t nextJobId = 0;

    // Id of the last dispense command accepted per actuator. The dashboard
    // re-sends a dispense command until it sees proof it arrived (the
    // network can lose it); a repeat carrying an id we already accepted is
    // acknowledged again but NOT queued a second time, so a lost
    // acknowledgement can never cause a double dispense.
    uint32_t lastDispenseId[NUM_LOAD_CELLS] = {};

    void setMode(uint8_t actuator, MachineMode mode);
    bool canAcceptJob(const JobRequest& request) const;
    void startNextJob(uint8_t actuator);
    void updateCurrentJob(uint8_t actuator);
    void synchronizeFlush();
    void initializeDispenseJob(uint8_t actuator, const JobRequest& request);
    void jobStarted(uint8_t actuator);
    void jobFinished(uint8_t actuator);
    void jobAccepted(uint8_t actuator);
    void jobRejected(uint8_t actuator, const char* reason);
    void emitEvent(uint8_t actuator, MachineEventType event);
    void resetMachine(uint8_t actuator);
    void resumeMachine(uint8_t actuator);
};