#include "MachineController.h"

MachineController::MachineController(
    MachineContext& ctx,
    StepperManager& step,
    LoadCellManager& load,
    ServoManager& servo,
    WifiManager& wifiMgr,
    MQTTManager& mqttMgr,
    SafetyManager& safetyMgr)

    : context(ctx),
      steppers(step),
      loadCells(load),
      servos(servo),
      wifi(wifiMgr),
      mqtt(mqttMgr),
      safety(safetyMgr)
{
}

void MachineController::begin()
{
    wifi.begin();

    mqtt.begin();

    steppers.begin();

    loadCells.begin();

    servos.begin();

    safety.begin();

    context.system.initialized = true;
}

void MachineController::update()
{
    wifi.update();

    mqtt.update();

    loadCells.update();

    steppers.update();

    servos.update();

    safety.update();

    context.system.uptime++;
}