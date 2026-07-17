#include <Arduino.h>

#include "MachineContext.h"

#include "StepperManager.h"
#include "LoadCellManager.h"
#include "ServoManager.h"
#include "WiFiManager.h"
#include "MQTTManager.h"
#include "SafetyManager.h"

#include "MachineController.h"

#include "Pins.h"

MachineContext context;

StepperManager stepperManager(context, STEP1, STEP2);
LoadCellManager loadCells(context);
ServoManager servos(context);
WifiManager wifi(context);
MQTTManager mqtt(context);
SafetyManager safety(context);

MachineController controller(
    context,
    stepperManager,
    loadCells,
    servos,
    wifi,
    mqtt,
    safety);

void setup()
{
    controller.begin();

    stepperManager.enable(0);

    stepperManager.setDirection(0, true);

    stepperManager.setSpeed(0, 1000);

    stepperManager.start(0);
    delay(3000);

    stepperManager.setSpeed(0, 500);
    delay(3000);

    stepperManager.setSpeed(0, 1500);
    delay(3000);

    stepperManager.setSpeed(0, 2500);
    delay(3000);

    stepperManager.stop(0);

    stepperManager.disable(0);
}

void loop()
{
    controller.update();
}