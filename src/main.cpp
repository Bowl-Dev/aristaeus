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
#include "SerialEventListener.h"
#include "EventDispatcher.h"
#include "MQTTEventListener.h"
#include "StatusManager.h"

MachineContext context;

StepperManager stepperManager(context, STEP1, STEP2);
LoadCellManager loadCellManager(context);
ServoManager servos(context);
WifiManager wifiManager;  
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
EventDispatcher eventDispatcher;
SerialEventListener serialListener;
MQTTEventListener mqttListener(mqttManager);
StatusManager statusManager(context, controller, mqttManager);

void setup()
{
    Serial.begin(115200);
    delay(1000);
    Serial.println("Setup started");
    
    wifiManager.begin();
    mqttManager.begin();

    eventDispatcher.addListener(&serialListener);
    eventDispatcher.addListener(&mqttListener);
    controller.setEventListener(&eventDispatcher);
    controller.begin();
    
    Serial.println("Controller started");    
    loadCellManager.requestTare(0);
    loadCellManager.requestTare(1);        
}

void loop()
{
    wifiManager.update();
    mqttManager.update();
    controller.update();
    statusManager.update();
}