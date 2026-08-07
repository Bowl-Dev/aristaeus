#pragma once

#include "IManager.h"
#include "MachineContext.h"
#include "Pins.h"
#include <ESP32Servo.h>

class ServoManager : public IManager
{
public:

    explicit ServoManager(MachineContext& context);

    void begin() override;

    void update() override;

    void openGate(uint8_t actuator);

    void closeGate(uint8_t actuator);

    bool isFlushing(uint8_t actuator) const;

private:

    MachineContext& context;

    Servo servos[NUM_LOAD_CELLS];

    bool gateOpen[NUM_LOAD_CELLS] = {};

    uint32_t openedAt[NUM_LOAD_CELLS] = {};
};

