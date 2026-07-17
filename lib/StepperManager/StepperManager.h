#pragma once

#include "IManager.h"
#include "MachineContext.h"
#include "Config.h"

struct StepperMotor
{
    StepperConfig config;

    bool enabled = false;
    bool running = false;

    float speed = 0.0f;

    bool direction = true;    

    volatile bool pulseState = false;

    volatile uint32_t pulseCounter = 0;
};

class StepperManager : public IManager
{
public:

    StepperManager(
        MachineContext& context,
        const StepperConfig& motor1,
        const StepperConfig& motor2);

    void begin() override;

    void update() override;

    void enable(uint8_t motor);

    void disable(uint8_t motor);

    void start(uint8_t motor);

    void stop(uint8_t motor);

    void setDirection(uint8_t motor, bool direction);

    void setSpeed(uint8_t motor, uint32_t speed);

private:

    MachineContext& context;

    StepperMotor motors[2];
};