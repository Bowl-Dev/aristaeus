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
        uint32_t alarmPeriodUs = 1000;
    };

    StepperHardware hw[2];
    StepperManager* manager = nullptr;
}


StepperManager::StepperManager(
    MachineContext& ctx,
    const StepperConfig& motor1,
    const StepperConfig& motor2)
    : context(ctx)
{
    motors[0].config = motor1;
    motors[1].config = motor2;
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
    pinMode(motors[0].config.stepPin, OUTPUT);
    pinMode(motors[0].config.dirPin, OUTPUT);
    pinMode(motors[0].config.enablePin, OUTPUT);

    pinMode(motors[1].config.stepPin, OUTPUT);
    pinMode(motors[1].config.dirPin, OUTPUT);
    pinMode(motors[1].config.enablePin, OUTPUT);

    hw[0].stepPin = motors[0].config.stepPin;
    hw[1].stepPin = motors[1].config.stepPin;

    hw[0].timer = timerBegin(1000000); // 1 MHz = 1 tick per microsecond
    hw[1].timer = timerBegin(1000000);

    timerAttachInterrupt(hw[0].timer, &onTimer1);
    timerAttachInterrupt(hw[1].timer, &onTimer2);

    timerAlarm(hw[0].timer, 500, true, 0);    
    timerAlarm(hw[1].timer, 500, true, 0);
}

void StepperManager::update()
{
}

void StepperManager::enable(uint8_t motor)
{
    if (motor > 1)
        return;

    digitalWrite(motors[motor].config.enablePin, LOW);
    motors[motor].enabled = true;
    context.stepper[motor].enabled = true;
}

void StepperManager::disable(uint8_t motor)
{
    if (motor > 1)
        return;

    digitalWrite(motors[motor].config.enablePin, HIGH);
    motors[motor].enabled = false;
    context.stepper[motor].enabled = false;
}

void StepperManager::start(uint8_t motor)
{
  if (motor > 1)
        return;

    if (!motors[motor].enabled)
        return;

    hw[motor].running = true;
    motors[motor].running = true;
    context.stepper[motor].running = true;
}

void StepperManager::stop(uint8_t motor)
{
  if (motor > 1)
        return;

    hw[motor].running = false;
    motors[motor].running = false;
    context.stepper[motor].running = false;
}

void StepperManager::setDirection(uint8_t motor, bool direction)
{
  if (motor > 1)
        return;

    motors[motor].direction = direction;
    context.stepper[motor].direction = direction;

    digitalWrite(
        motors[motor].config.dirPin,
        direction ? HIGH : LOW);
}

void StepperManager::setSpeed(uint8_t motor, uint32_t stepsPerSecond)
{
   if (motor > 1)
        return;

    if (stepsPerSecond < 1.0f)
        stepsPerSecond = 1.0f;

    motors[motor].speed = stepsPerSecond;

    context.stepper[motor].speed = stepsPerSecond;

    uint32_t period =
        (uint32_t)(1000000.0f / (2.0f * stepsPerSecond));

    hw[motor].alarmPeriodUs = period;

    timerAlarm(
        hw[motor].timer,
        period,
        true,
        0);
}