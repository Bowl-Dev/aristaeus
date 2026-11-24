#include <Arduino.h>
#include "StepperManager.h"

namespace
{
    struct StepperHardware
    {
        hw_timer_t* timer = nullptr;
        uint8_t stepPin = 0;
        volatile bool running = false;
        volatile bool level = false;
    };

    StepperHardware hw[2];
}

StepperManager::StepperManager(const StepperConfig& motor1, const StepperConfig& motor2)
    : config{motor1, motor2}
{
}

void IRAM_ATTR onTimer1()
{
  if (hw[0].running)
  {
    hw[0].level = !hw[0].level;
    gpio_set_level((gpio_num_t)hw[0].stepPin, hw[0].level);
  }
  else
  {
    gpio_set_level((gpio_num_t)hw[0].stepPin, 0);
  }
}

void IRAM_ATTR onTimer2()
{
  if (hw[1].running)
  {
    hw[1].level = !hw[1].level;
    gpio_set_level((gpio_num_t)hw[1].stepPin, hw[1].level);
  }
  else
  {
    gpio_set_level((gpio_num_t)hw[1].stepPin, 0);
  }
}

void StepperManager::begin()
{
    for (uint8_t i = 0; i < 2; i++)
    {
        pinMode(config[i].stepPin, OUTPUT);
        pinMode(config[i].dirPin, OUTPUT);
        pinMode(config[i].enablePin, OUTPUT);
        hw[i].stepPin = config[i].stepPin;
    }

    hw[0].timer = timerBegin(0,80,true); // 1 MHz = 1 tick per microsecond
    hw[1].timer = timerBegin(1,80,true);

    timerAttachInterrupt(hw[0].timer, &onTimer1, true);
    timerAttachInterrupt(hw[1].timer, &onTimer2, true);

    timerAlarmWrite(hw[0].timer, 500, true);
    timerAlarmEnable(hw[0].timer);
    timerAlarmWrite(hw[1].timer, 500, true);
    timerAlarmEnable(hw[1].timer);

    disable(0);
    disable(1);
}

void StepperManager::enable(uint8_t motor)
{
    if (motor > 1)
        return;

    digitalWrite(config[motor].enablePin, LOW);
    enabled[motor] = true;
}

void StepperManager::disable(uint8_t motor)
{
    if (motor > 1)
        return;

    digitalWrite(config[motor].enablePin, HIGH);
    enabled[motor] = false;
}

void StepperManager::start(uint8_t motor)
{
    if (motor > 1 || !enabled[motor])
        return;

    hw[motor].running = true;
}

void StepperManager::stop(uint8_t motor)
{
    if (motor > 1)
        return;

    hw[motor].running = false;
}

void StepperManager::setDirection(uint8_t motor, bool direction)
{
    if (motor > 1)
        return;

    digitalWrite(config[motor].dirPin, direction ? HIGH : LOW);
}

void StepperManager::setSpeed(uint8_t motor, uint32_t stepsPerSecond)
{
    if (motor > 1)
        return;

    if (stepsPerSecond < 1)
        stepsPerSecond = 1;

    uint32_t period = (uint32_t)(1000000.0f / (2.0f * stepsPerSecond));

    timerAlarmWrite(hw[motor].timer, period, true);
}
