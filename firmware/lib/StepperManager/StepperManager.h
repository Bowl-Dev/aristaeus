#pragma once

#include "Config.h"

class StepperManager
{
public:

    StepperManager(const StepperConfig& motor1, const StepperConfig& motor2);

    void begin();

    void enable(uint8_t motor);

    void disable(uint8_t motor);

    void start(uint8_t motor);

    void stop(uint8_t motor);

    void setDirection(uint8_t motor, bool direction);

    void setSpeed(uint8_t motor, uint32_t speed);

private:

    StepperConfig config[2];
    bool enabled[2] = {};
};
