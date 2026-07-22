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
LoadCellManager loadCellManager(context);
ServoManager servos(context);
WifiManager wifi(context);
MQTTManager mqtt(context);
SafetyManager safety(context);

MachineController controller(
    context,
    stepperManager,
    loadCellManager,
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
    loadCellManager.requestTare(0);
    loadCellManager.requestTare(1);

    JobRequest request;

    request.type = JobType::Dispense;
    request.actuator = 0;
    request.target = 50.0f;

    controller.enqueueJob(request);
    Serial.println("Job queued");    
}

void loop()
{
    static uint32_t lastPrint = 0;

    if (millis() - lastPrint >= 500)
    {
        lastPrint = millis();

        Serial.print("Raw0: ");
        Serial.print(loadCellManager.getRaw(0));

        Serial.print("    Raw1: ");
        Serial.println(loadCellManager.getRaw(1));

        Serial.print("W0: ");
        Serial.print(loadCellManager.getWeight(0));

        Serial.print("    W1: ");
        Serial.println(loadCellManager.getWeight(1));       
    }
    controller.update();
}