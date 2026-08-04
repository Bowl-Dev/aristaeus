#include "MachineController.h"
#include "Pins.h"
#include <Arduino.h>

MachineController::MachineController(
    MachineContext& ctx,
    StepperManager& step,
    LoadCellManager& load,
    ServoManager& servo,
    WifiManager& wifiMgr,    
    SafetyManager& safetyMgr)

    : context(ctx),
      stepperManager(step),
      loadCellManager(load),
      servoManager(servo),
      wifiManager(wifiMgr),      
      safetyManager(safetyMgr),
      services{
            stepperManager,
            loadCellManager,
            servoManager,            
            wifiManager,
            safetyManager}
{
}

void MachineController::begin()
{
    wifiManager.begin();    
    stepperManager.begin();
    loadCellManager.begin();
    servoManager.begin();
    safetyManager.begin();

    context.system.initialized = true;

    setMode(MachineMode::Ready);
    Serial.println("Machine Mode: Ready");
}

void MachineController::update()
{
    wifiManager.update();
    loadCellManager.update();
    stepperManager.update();
    servoManager.update();
    safetyManager.update();

    startNextJob();
    updateCurrentJob();
    finishCurrentJob();
    
    currentState.uptime = millis();

    context.system.uptime++;
}

bool MachineController::enqueueJob(const JobRequest& request)
{
    JobRequest job = request;    
    //return jobQueue.enqueue(request);
    if (job.id == 0)
    {
        job.id = nextJobId++;
    }
    bool ok = jobQueue.enqueue(job);

    if (ok)
    {
        currentState.queuedJobs = jobQueue.size();
    }

    return ok;
}

const MachineState& MachineController::state() const
{
    return currentState;
}

void MachineController::setMode(MachineMode mode)
{
    if (currentState.mode == mode)
        return;

    currentState.mode = mode;
}

/*bool MachineController::executeCommand(const Command& command)
{
    switch (command.type)
    {
        case CommandType::Dispense:
        {
            JobRequest request;

            request.type = JobType::Dispense;
            request.dispense = command.dispense;

            return enqueueJob(request);
        }
        case CommandType::Tare:
            Serial.println("Tare command received");
            return true;

        case CommandType::Ping:
            Serial.println("Ping command received");
            return true;

        case CommandType::EmergencyStop:
            Serial.println("Emergency Stop command received");
            return true;

        case CommandType::Reset:
            Serial.println("Reset command received");
            return true;

        case CommandType::Reboot:
            Serial.println("Reboot command received");
            return true;

        default:
            Serial.println("Unsupported command");
            return false;
    }
}*/

bool MachineController::processJobRequest(const JobRequest& request)
{
    if (!canAcceptJob(request))
        return false;

    switch (request.type)
    {
        case JobType::Dispense:
            //return enqueueJob(request);
            if (request.targetWeight <= 0.0f)
            {
            Serial.println("Invalid target weight");
            return false;
            }

            if (request.actuator >= NUM_LOAD_CELLS)
            {
                jobRejected("Invalid actuator");
                return false;
            }

            if (!context.system.initialized)
            {
                jobRejected("System not initialized");
                return false;
            }

            if (currentState.mode == MachineMode::EmergencyStop)
            {
                jobRejected("Machine in Emergency Stop");
                return false;
            }

            if (currentState.mode == MachineMode::Error)
            {
                jobRejected("Machine in Error state");
                return false;
            }

            if (jobQueue.full())
            {
                jobRejected("Queue full");
                return false;
            }
            if (!enqueueJob(request))
                return false;
            jobAccepted(request);
            return true;
            
            //return enqueueJob(request);
            //return true;        

        case JobType::MoveServo:
            return enqueueJob(request);

        case JobType::Reset:
            resetMachine();
            break;

        case JobType::None:
        default:
            Serial.println("Unknown JobType");
            return false;
    }
}

bool MachineController::canAcceptJob(const JobRequest&) const
{
    return true;
}

void MachineController::startNextJob()
{
    if (currentJobType == JobType::None)
    {
        JobRequest request;

        if (jobQueue.dequeue(request))
        {
        currentState.queuedJobs = jobQueue.size();
        currentState.activeJob.active = true;
        currentState.activeJob.id = request.id;
        currentState.activeJob.actuator = request.actuator;
        currentState.activeJob.targetWeight = request.targetWeight;
        currentState.activeJob.currentWeight = 0.0f;
        currentState.activeJob.progress = 0;
        currentState.activeJob.lastProgressWeight = 0.0f;
        currentState.activeJob.lastProgressTime = millis();

        switch (request.type)
            {
            case JobType::Dispense:

                initializeDispenseJob(request);

                Jobs::beginDispenseJob(dispenseJob, services);
                currentJobType = JobType::Dispense;
                jobStarted();                

                break;
                default:
                break;
            }
        }
    }
}

void MachineController::updateCurrentJob()
{
    switch (currentJobType)
    {
        case JobType::Dispense:

            Jobs::updateDispenseJob(dispenseJob, services);
            if ( dispenseJob.state == JobState::Running)
            {
                float weight = services.loadCell.getWeight(dispenseJob.actuator);
                currentState.activeJob.currentWeight = weight;                

                if (weight >= currentState.activeJob.lastProgressWeight + MIN_PROGRESS)
                {
                    currentState.activeJob.lastProgressWeight = weight;
                    currentState.activeJob.lastProgressTime = millis();
                }                

                if (millis() - currentState.activeJob.lastProgressTime > STALL_TIMEOUT_MS)
                {
                    services.stepper.stop(dispenseJob.actuator);
                    currentState.lastError = "Dispense stalled";
                    setMode(MachineMode::Error);
                    //emitEvent(MachineEventType::Error);                    
                }

                float progress = (weight * 100.0f) / currentState.activeJob.targetWeight;
                progress = constrain(progress, 0.0f, 100.0f);
                currentState.activeJob.progress = static_cast<uint8_t>(progress);            
            }
            break;
            default:
            break;
    }
}

void MachineController::finishCurrentJob()
{
    if (currentJobType == JobType::Dispense)
    {
        if (dispenseJob.state == JobState::Finished)
        {
            currentState.activeJob.active = false;
            currentState.activeJob.progress = 100;
            currentState.activeJob.currentWeight = currentState.activeJob.targetWeight;
            Serial.println("DispenseJob completed");
            jobFinished();
        }
     }
}

void MachineController::initializeDispenseJob(const JobRequest& request)
{
    dispenseJob.state = JobState::Idle;
    dispenseJob.actuator = request.actuator;
    dispenseJob.targetWeight = request.targetWeight;
    dispenseJob.speed = request.speed;
}

void MachineController::jobStarted()
{
    setMode(MachineMode::Running);    
    emitEvent(MachineEventType::JobStarted);
}

void MachineController::jobFinished()
{
    currentJobType = JobType::None;
    setMode(MachineMode::Ready);    
    emitEvent(MachineEventType::JobFinished);
}

void MachineController::jobAccepted(const JobRequest& request)
{
    emitEvent(MachineEventType::JobAccepted);    
}

void MachineController::jobRejected(const char* reason)
{
    emitEvent(MachineEventType::JobRejected);
    Serial.println(reason);
}

void MachineController::emitEvent(MachineEventType type)
{
    if (!eventListener)
        return;

    MachineEvent event;

    event.type = type;
    event.timestamp = millis();
    eventListener->onMachineEvent(event);       
}

void MachineController::setEventListener(MachineEventListener* listener)
{
    eventListener = listener;
}

void MachineController::resetMachine()
{
    Serial.println("Resetting machine...");
    currentState.lastError = "";
    currentState.activeJob = ActiveJobState{};
    //request = JobRequest{};
    dispenseJob = DispenseJob{};
    setMode(MachineMode::Ready);
    Serial.println("Machine reset.");
}