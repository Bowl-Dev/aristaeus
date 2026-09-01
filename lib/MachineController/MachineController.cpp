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

    for (uint8_t i = 0; i < NUM_LOAD_CELLS; i++)
    {
        setMode(i, MachineMode::Ready);
    }

    Serial.println("Machine Mode: Ready");
}

void MachineController::update()
{
    wifiManager.update();
    loadCellManager.update();
    stepperManager.update();
    servoManager.update();
    safetyManager.update();

    for (uint8_t i = 0; i < NUM_LOAD_CELLS; i++)
    {
        startNextJob(i);
        updateCurrentJob(i);
    }

    synchronizeFlush();

    currentState.uptime = millis();
    context.system.uptime++;
}

bool MachineController::enqueueJob(const JobRequest& request)
{
    if (request.actuator >= NUM_LOAD_CELLS)
        return false;

    JobRequest job = request;    
    
    if (job.id == 0)
    {
        job.id = nextJobId++;
    }
    bool ok = jobQueue[request.actuator].enqueue(job);

    if (ok)
    {
        currentState.actuator[request.actuator].queuedJobs = jobQueue[request.actuator].size();
    }

    return ok;
}

const MachineState& MachineController::state() const
{
    return currentState;
}

void MachineController::setMode(uint8_t actuator, MachineMode mode)
{
    if (currentState.actuator[actuator].mode == mode)
        return;

    currentState.actuator[actuator].mode = mode;
}

bool MachineController::processJobRequest(const JobRequest& request)
{
    if (!canAcceptJob(request))
        return false;

    switch (request.type)
    {
        case JobType::Dispense:

            if (request.actuator >= NUM_LOAD_CELLS)
            {
                Serial.println("Invalid actuator");
                return false;
            }
            
            if (request.targetWeight <= 0.0f)
            {
            Serial.println("Invalid target weight");
            return false;
            }            

            if (!context.system.initialized)
            {
                jobRejected(request.actuator, "System not initialized");
                return false;
            }

            if (context.system.emergencyStop)
            {
                jobRejected(request.actuator, "Machine in Emergency Stop");
                return false;
            }

            if (currentState.actuator[request.actuator].mode == MachineMode::Error)
            {
                jobRejected(request.actuator, "Actuator in Error state");
                return false;
            }

            if (jobQueue[request.actuator].full())
            {
                jobRejected(request.actuator, "Queue full");
                return false;
            }
            if (!enqueueJob(request))
                return false;

            jobAccepted(request.actuator);
            return true;        

        case JobType::Tare:

            if (request.actuator >= NUM_LOAD_CELLS)
            {
                Serial.println("Invalid actuator");
                return false;
            }

            if (currentState.actuator[request.actuator].mode == MachineMode::Dispensing || currentState.actuator[request.actuator].mode == MachineMode::Flushing)
            {
                jobRejected(request.actuator, "Cannot tare while a job is running");
                return false;
            }

            if (!services.loadCell.requestTare(request.actuator))
            {
                jobRejected(request.actuator, "Tare failed, load cell not responding");
                return false;
            }

            jobAccepted(request.actuator);
            emitEvent(request.actuator, MachineEventType::JobFinished);
            return true;

        case JobType::Calibrate:

            if (request.actuator >= NUM_LOAD_CELLS)
            {
                Serial.println("Invalid actuator");
                return false;
            }

            if (currentState.actuator[request.actuator].mode == MachineMode::Dispensing || currentState.actuator[request.actuator].mode == MachineMode::Flushing)
            {
                jobRejected(request.actuator, "Cannot calibrate while a job is running");
                return false;
            }

            if (request.targetWeight <= 0.0f)
            {
                jobRejected(request.actuator, "Invalid known weight");
                return false;
            }

            if (!services.loadCell.calibrate(request.actuator, request.targetWeight))
            {
                jobRejected(request.actuator, "Calibration failed - load cell not responding, or the reading looked invalid");
                return false;
            }

            jobAccepted(request.actuator);
            emitEvent(request.actuator, MachineEventType::JobFinished);
            return true;

        case JobType::Reset:

            if (request.actuator >= NUM_LOAD_CELLS)
            {
                Serial.println("Invalid actuator");
                return false;
            }
            resetMachine(request.actuator);
            return true;            

        case JobType::Resume:

            if (request.actuator >= NUM_LOAD_CELLS)
            {
                Serial.println("Invalid actuator");
                return false;
            }

            if (context.system.emergencyStop)
            {
                jobRejected(request.actuator, "Cannot resume during Emergency Stop");
                return false;
            }

            if (currentState.actuator[request.actuator].mode != MachineMode::Error)
            {
                jobRejected(request.actuator, "Nothing to resume");
                return false;
            }

            resumeMachine(request.actuator);
            return true;

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

void MachineController::startNextJob(uint8_t actuator)
{
    if (currentState.actuator[actuator].mode != MachineMode::Ready)
        return;

    JobRequest request;

    if (!jobQueue[actuator].dequeue(request))
        return;

    ActuatorState& a = currentState.actuator[actuator];

    a.queuedJobs = jobQueue[actuator].size();
    a.activeJob.active = true;
    a.activeJob.id = request.id;
    a.activeJob.actuator = request.actuator;
    a.activeJob.targetWeight = request.targetWeight;
    a.activeJob.currentWeight = 0.0f;
    a.activeJob.progress = 0;
    a.activeJob.lastProgressWeight = 0.0f;
    a.activeJob.lastProgressTime = millis();

    initializeDispenseJob(actuator, request);

    Jobs::beginDispenseJob(dispenseJob[actuator], services, a.mode);

    jobStarted(actuator);    
}

void MachineController::updateCurrentJob(uint8_t actuator)
{
    ActuatorState& a = currentState.actuator[actuator];

    if (a.mode != MachineMode::Dispensing && a.mode != MachineMode::Flushing)
    return;

    MachineMode previousMode = a.mode;

    Jobs::updateDispenseJob(dispenseJob[actuator], services, a.mode);

    if (a.mode == MachineMode::Dispensing)
    {
        float weight = services.loadCell.getWeight(dispenseJob[actuator].actuator);
        a.activeJob.currentWeight = weight;

        if (weight >= a.activeJob.lastProgressWeight + MIN_PROGRESS)
        {
            a.activeJob.lastProgressWeight = weight;
            a.activeJob.lastProgressTime = millis();
        }

        if (millis() - a.activeJob.lastProgressTime > STALL_TIMEOUT_MS)
        {
            services.stepper.stop(dispenseJob[actuator].actuator);
            services.stepper.disable(dispenseJob[actuator].actuator);
            a.lastError = "Dispense stalled";
            setMode(actuator, MachineMode::Error);
            emitEvent(actuator, MachineEventType::Error);
            return;
        }

        float progress = (weight * 100.0f) / a.activeJob.targetWeight;
        progress = constrain(progress, 0.0f, 100.0f);
        a.activeJob.progress = static_cast<uint8_t>(progress);
    }

    if (previousMode != MachineMode::Ready && a.mode == MachineMode::Ready)
    {
        jobFinished(actuator);
    }    
}

void MachineController::synchronizeFlush()
{
    if (!SYNCHRONIZED_FLUSH)
        return;

    // Hold every actuator that already reached target weight (parked in
    // WaitingToFlush by Jobs::updateDispenseJob) as long as ANY actuator is
    // still actively dispensing. An actuator that was never given a job
    // this round just sits in Ready/Error/etc. the whole time and is not
    // "still dispensing", so it never blocks the ones that were - a single
    // actuator's own ingredient flushes immediately, same as before, and
    // only actually waits when a sibling is genuinely mid-dispense too.
    for (uint8_t i = 0; i < NUM_LOAD_CELLS; i++)
    {
        if (currentState.actuator[i].mode == MachineMode::Dispensing)
            return;
    }

    for (uint8_t i = 0; i < NUM_LOAD_CELLS; i++)
    {
        if (currentState.actuator[i].mode != MachineMode::WaitingToFlush)
            continue;

        Serial.print("Synchronized flush: opening gate ");
        Serial.println(i);

        services.servo.openGate(i);
        setMode(i, MachineMode::Flushing);
    }
}

void MachineController::initializeDispenseJob(uint8_t actuator, const JobRequest& request)
{
    dispenseJob[actuator].actuator = request.actuator;
    dispenseJob[actuator].targetWeight = request.targetWeight;
    dispenseJob[actuator].speed = request.speed;
}

void MachineController::jobStarted(uint8_t actuator)
{
    emitEvent(actuator, MachineEventType::JobStarted);
}

void MachineController::jobFinished(uint8_t actuator)
{
    ActuatorState& a = currentState.actuator[actuator];

    a.activeJob.active = false;
    a.activeJob.progress = 100;
    a.activeJob.currentWeight = a.activeJob.targetWeight;
    Serial.println("DispenseJob completed");
      
    emitEvent(actuator, MachineEventType::JobFinished);
}

void MachineController::jobAccepted(uint8_t actuator)
{
    emitEvent(actuator, MachineEventType::JobAccepted);    
}

void MachineController::jobRejected(uint8_t actuator, const char* reason)
{
    emitEvent(actuator, MachineEventType::JobRejected);
    Serial.println(reason);
}

void MachineController::emitEvent(uint8_t actuator, MachineEventType type)
{
    if (!eventListener)
        return;

    MachineEvent event;

    event.type = type;
    event.actuator = actuator;
    event.timestamp = millis();
    eventListener->onMachineEvent(event);       
}

void MachineController::setEventListener(MachineEventListener* listener)
{
    eventListener = listener;
}

void MachineController::resetMachine(uint8_t actuator)
{
    Serial.println("Resetting actuator...");
    Serial.println(actuator);

    // If this actuator was mid-dispense, abandoning the job must not leave
    // the motor energized and running - Reset always returns the actuator
    // to its default state, and motors are disabled by default.
    services.stepper.stop(actuator);
    services.stepper.disable(actuator);

    ActuatorState& a = currentState.actuator[actuator];

    a.lastError = "";
    a.activeJob = ActiveJobState{};
    dispenseJob[actuator] = DispenseJob{};
    setMode(actuator, MachineMode::Ready);
    Serial.println("Actuator reset.");
}

void MachineController::resumeMachine(uint8_t actuator)
{
    Serial.println("Resuming job on actuator");
    Serial.println(actuator);

    // dispenseJob still holds the actuator/targetWeight/speed from before the
    // stall - resetMachine() is the only thing that clears it, and we
    // deliberately don't call that here.
    ActuatorState& a = currentState.actuator[actuator];
    services.stepper.enable(dispenseJob[actuator].actuator);
    services.stepper.setDirection(dispenseJob[actuator].actuator, true);
    services.stepper.setSpeed(dispenseJob[actuator].actuator, dispenseJob[actuator].speed);
    services.stepper.start(dispenseJob[actuator].actuator);

    a.lastError = "";
    a.activeJob.lastProgressWeight = services.loadCell.getWeight(dispenseJob[actuator].actuator);
    a.activeJob.lastProgressTime = millis();

    setMode(actuator, MachineMode::Dispensing);

    emitEvent(actuator, MachineEventType::ErrorCleared);

    Serial.println("Dispense resumed.");
}