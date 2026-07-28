#include <Arduino.h>

#include "MachineContext.h"

#include "StepperManager.h"
#include "LoadCellManager.h"
#include "ServoManager.h"
#include "WiFiManager.h"
#include "MQTTManager.h"
#include "SafetyManager.h"
#include "MachineController.h"
#include "Protocol.h"



MachineContext context;

StepperManager stepperManager(context, STEP1, STEP2);
LoadCellManager loadCellManager(context);
ServoManager servos(context);
WifiManager wifiManager;  //(context);
Protocol protocol;
SafetyManager safety(context);
MachineController controller(
    context,
    stepperManager,
    loadCellManager,
    servos,
    wifiManager,    
    safety);

MQTTManager mqttManager(controller, protocol);

void setup()
{
    Serial.begin(115200);
    delay(1000);
    Serial.println("Setup started");
    
    wifiManager.begin();
    mqttManager.begin();

    controller.begin();
    Serial.println("Controller started");    
    loadCellManager.requestTare(0);
    loadCellManager.requestTare(1);
    
    JobRequest request;

    const char* json =
    R"({
        "command":"dispense",
        "actuator":1,
        "targetWeight":42.5,
        "speed":800
    })";

    if(protocol.parse(json, request))
    {
        Serial.println("Protocol OK");
        Serial.println(request.actuator);
        Serial.println(request.targetWeight);
        Serial.println(request.speed);
    }

    controller.enqueueJob(request);
    Serial.println("Job queued");    
}

void loop()
{
    /*static uint32_t lastPrint = 0;

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
    }*/
    wifiManager.update();
    mqttManager.update();
    controller.update();
}