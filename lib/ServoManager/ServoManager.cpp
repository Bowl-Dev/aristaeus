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

        gateOpen[i] = false;
        context.servo[i].position = SERVO_CONFIGS[i].closedAngle;
    }
}

void ServoManager::update()
{
    // Timing is computed on demand in isFlushing(); nothing to poll here.
}

void ServoManager::openGate(uint8_t actuator)
{
    if (actuator >= NUM_LOAD_CELLS)
        return;

    servos[actuator].write(SERVO_CONFIGS[actuator].openAngle);

    gateOpen[actuator] = true;
    openedAt[actuator] = millis();

    context.servo[actuator].position = SERVO_CONFIGS[actuator].openAngle;
}

void ServoManager::closeGate(uint8_t actuator)
{
    if (actuator >= NUM_LOAD_CELLS)
        return;

    servos[actuator].write(SERVO_CONFIGS[actuator].closedAngle);

    gateOpen[actuator] = false;

    context.servo[actuator].position = SERVO_CONFIGS[actuator].closedAngle;
}

bool ServoManager::isFlushing(uint8_t actuator) const
{
    if (actuator >= NUM_LOAD_CELLS)
        return false;

    if (!gateOpen[actuator])
        return false;

    return (millis() - openedAt[actuator]) < FLUSH_DURATION_MS;
}