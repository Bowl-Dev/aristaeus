#include "ServoManager.h"
#include "Config.h"
#include <Arduino.h>

namespace
{
    constexpr ServoConfig SERVO_CONFIGS[NUM_LOAD_CELLS] = { SERVO1, SERVO2 };
}

ServoManager::ServoManager(MachineContext& ctx)
    : context(ctx)
{
}

void ServoManager::begin()
{
    for (uint8_t i = 0; i < NUM_LOAD_CELLS; i++)
    {
        servos[i].setPeriodHertz(50);
        servos[i].attach(
            SERVO_CONFIGS[i].pin,
            SERVO_CONFIGS[i].minPulse,
            SERVO_CONFIGS[i].maxPulse);

        servos[i].write(SERVO_CONFIGS[i].closedAngle);
        attached[i] = true;

        gateOpen[i] = false;
        currentAngle[i] = SERVO_CONFIGS[i].closedAngle;
        targetAngle[i] = SERVO_CONFIGS[i].closedAngle;
        lastStepAt[i] = millis();
        context.servo[i].position = SERVO_CONFIGS[i].closedAngle;
    }
}

void ServoManager::update()
{
    // Moves each servo one degree at a time toward its target angle instead
    // of snapping there instantly - openGate()/closeGate() just set the
    // target, this is what actually walks currentAngle toward it over time.
    // SERVO_STEP_INTERVAL_MS (Pins.h) controls how slow: raise it to slow
    // the gates down further, lower it to speed them back up.
    uint32_t now = millis();

    for (uint8_t i = 0; i < NUM_LOAD_CELLS; i++)
    {
        if (currentAngle[i] == targetAngle[i])
        {
            // Arrived: once the servo has had time to finish travelling,
            // release it so it stops hunting around the target.
            if (attached[i] && now - lastStepAt[i] >= SERVO_RELEASE_DELAY_MS)
            {
                servos[i].detach();
                attached[i] = false;
            }
            continue;
        }

        if (now - lastStepAt[i] < SERVO_STEP_INTERVAL_MS)
            continue;

        lastStepAt[i] = now;

        if (currentAngle[i] < targetAngle[i])
            currentAngle[i]++;
        else
            currentAngle[i]--;

        servos[i].write(currentAngle[i]);
        context.servo[i].position = currentAngle[i];
    }
}

void ServoManager::attachServo(uint8_t actuator)
{
    if (attached[actuator])
        return;

    servos[actuator].setPeriodHertz(50);
    servos[actuator].attach(
        SERVO_CONFIGS[actuator].pin,
        SERVO_CONFIGS[actuator].minPulse,
        SERVO_CONFIGS[actuator].maxPulse);

    // Start from where the gate currently is, so re-attaching doesn't jerk it.
    servos[actuator].write(currentAngle[actuator]);
    attached[actuator] = true;
    lastStepAt[actuator] = millis();
}

void ServoManager::openGate(uint8_t actuator)
{
    if (actuator >= NUM_LOAD_CELLS)
        return;

    if (currentAngle[actuator] != SERVO_CONFIGS[actuator].openAngle)
        attachServo(actuator);

    targetAngle[actuator] = SERVO_CONFIGS[actuator].openAngle;

    gateOpen[actuator] = true;
    openedAt[actuator] = millis();
}

void ServoManager::closeGate(uint8_t actuator)
{
    if (actuator >= NUM_LOAD_CELLS)
        return;

    if (currentAngle[actuator] != SERVO_CONFIGS[actuator].closedAngle)
        attachServo(actuator);

    targetAngle[actuator] = SERVO_CONFIGS[actuator].closedAngle;

    gateOpen[actuator] = false;
}

bool ServoManager::isFlushing(uint8_t actuator) const
{
    if (actuator >= NUM_LOAD_CELLS)
        return false;

    if (!gateOpen[actuator])
        return false;

    return (millis() - openedAt[actuator]) < FLUSH_DURATION_MS;
}