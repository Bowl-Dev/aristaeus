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
    Serial.begin(115200);
    delay(1000);
    Serial.println("Setup started");

    controller.begin();
    Serial.println("Controller started");

    JobRequest request;

    request.type = JobType::Dispense;
    request.actuator = 0;
    request.target = 50.0f;

    controller.enqueueJob(request);
    Serial.println("Job queued");
}

void loop()
{
    controller.update();
}