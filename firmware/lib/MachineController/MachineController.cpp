#include "MachineController.h"
#include "Pins.h"
#include <Arduino.h>

MachineController::MachineController(
    StepperManager& step,
    LoadCellManager& load,
    ServoManager& servo)

    : stepperManager(step),
      loadCellManager(load),
      servoManager(servo),
      services{stepperManager, loadCellManager, servoManager}
{
}

void MachineController::begin()
{
    stepperManager.begin();
    loadCellManager.begin();
    servoManager.begin();

    for (uint8_t i = 0; i < NUM_LOAD_CELLS; i++)
    {
        setMode(i, MachineMode::Ready);
    }

    Serial.println("Machine Mode: Ready");
}

void MachineController::update()
{
    loadCellManager.update();
    servoManager.update();

    for (uint8_t i = 0; i < NUM_LOAD_CELLS; i++)
    {
        startNextJob(i);
        updateCurrentJob(i);
    }

    synchronizeFlush();

    currentState.uptime = millis();
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
    if (request.actuator >= NUM_LOAD_CELLS)
    {
        Serial.println("Invalid actuator");
        return false;
    }

    switch (request.type)
    {
        case JobType::Dispense:

            if (request.targetWeight <= 0.0f)
            {
            Serial.println("Invalid target weight");
            return false;
            }            

            // Repeat of a command we already accepted (the dashboard re-sends
            // until it sees confirmation): confirm again, don't queue twice.
            if (request.id != 0 && request.id == lastDispenseId[request.actuator])
            {
                Serial.println("Duplicate dispense command ignored (already accepted)");
                jobAccepted(request.actuator);
                return true;
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

            if (request.id != 0)
                lastDispenseId[request.actuator] = request.id;

            jobAccepted(request.actuator);
            return true;

        case JobType::Tare:

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

        case JobType::MoveServo:

            // Manual gate control for clearing a jam or cleaning - must not
            // fight an active dispense/flush cycle on this actuator, or (on
            // synchronized-flush units) desync the sibling actuator waiting
            // to flush alongside it.
            if (currentState.actuator[request.actuator].mode == MachineMode::Dispensing ||
                currentState.actuator[request.actuator].mode == MachineMode::Flushing ||
                currentState.actuator[request.actuator].mode == MachineMode::WaitingToFlush)
            {
                jobRejected(request.actuator, "Cannot move the gate while a dispense job is active");
                return false;
            }

            if (request.openGate)
                services.servo.openGate(request.actuator);
            else
                services.servo.closeGate(request.actuator);

            jobAccepted(request.actuator);
            emitEvent(request.actuator, MachineEventType::JobFinished);
            return true;

        case JobType::Flush:

            if (currentState.actuator[request.actuator].mode != MachineMode::WaitingToFlush)
            {
                jobRejected(request.actuator, "Nothing waiting to flush");
                return false;
            }

            Serial.print("Manual flush: opening gate ");
            Serial.println(request.actuator);

            dispenseJob[request.actuator].holdFlush = false;
            services.servo.openGate(request.actuator);
            setMode(request.actuator, MachineMode::Flushing);
            jobAccepted(request.actuator);
            return true;

        case JobType::Reset:

            resetMachine(request.actuator);
            return true;            

        case JobType::Resume:

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

        // Held by the dashboard until the operator commands a flush.
        if (dispenseJob[i].holdFlush)
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
    dispenseJob[actuator].holdFlush = request.holdFlush;
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