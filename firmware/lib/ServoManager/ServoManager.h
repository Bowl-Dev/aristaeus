#pragma once

#include "Pins.h"
#include <ESP32Servo.h>

class ServoManager
{
public:

    void begin();

    void update();

    void openGate(uint8_t actuator);

    void closeGate(uint8_t actuator);

    bool isFlushing(uint8_t actuator) const;

private:

    Servo servos[NUM_LOAD_CELLS];

    bool gateOpen[NUM_LOAD_CELLS] = {};

    uint32_t openedAt[NUM_LOAD_CELLS] = {};

    // Gates move gradually (see update()) instead of snapping straight to
    // the target angle - currentAngle tracks where the servo actually is
    // right now, targetAngle is where openGate()/closeGate() want it to end
    // up, and lastStepAt paces one degree per SERVO_STEP_INTERVAL_MS.
    uint8_t currentAngle[NUM_LOAD_CELLS] = {};
    uint8_t targetAngle[NUM_LOAD_CELLS] = {};
    uint32_t lastStepAt[NUM_LOAD_CELLS] = {};

    // A servo that has reached its target is detached (no more pulses sent)
    // after SERVO_RELEASE_DELAY_MS, so it can't hunt/jitter while idle. It
    // is re-attached the moment a new move starts.
    bool attached[NUM_LOAD_CELLS] = {};

    void attachServo(uint8_t actuator);
};

