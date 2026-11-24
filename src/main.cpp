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
#include "Config.h"
#include <WiFi.h>

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
    Serial.print("Reset reason: ");
    Serial.println(resetReasonToString());
    Serial.print("Device ID: ");
    Serial.println(DEVICE_ID);
    Serial.print("MAC address: ");
    Serial.println(WiFi.macAddress());
    Serial.print("Command topic: ");
    Serial.println(MQTT_COMMAND_TOPIC);
    Serial.print("Status topic: ");
    Serial.println(MQTT_STATUS_TOPIC);

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
    // Measure the time between consecutive loop() passes. If something blocks
    // the loop (HX711 read, mDNS lookup, WiFi reconnect...), MQTT can't send
    // keepalives and the broker times the unit out.
    static uint32_t lastLoopAt = 0;
    uint32_t loopNow = millis();
    if (lastLoopAt != 0)
    {
        uint32_t gap = loopNow - lastLoopAt;
        if (gap > context.communication.maxLoopMs)
            context.communication.maxLoopMs = gap;
        if (gap > 1000)
        {
            Serial.print("DIAG: main loop stalled for ");
            Serial.print(gap);
            Serial.println(" ms");
        }
    }
    lastLoopAt = loopNow;

    wifiManager.update();
    mqttManager.update();

    // wifiManager/mqttManager track their own connection state internally,
    // but nothing was copying it into MachineContext - so the "wifi"/"mqtt"
    // fields StatusManager publishes were always stuck at their default
    // (false). Refresh them here, once per loop, before anything reads them.
    bool wifiNow = wifiManager.connected();
    bool mqttNow = mqttManager.connected();

    // Count and log every connection loss, so the serial monitor shows
    // exactly when and why a unit drops off.
    if (context.communication.wifiConnected && !wifiNow)
    {
        context.communication.wifiDrops++;
        Serial.print("DIAG: WiFi lost (drop #");
        Serial.print(context.communication.wifiDrops);
        Serial.print(") at ");
        Serial.print(millis() / 1000);
        Serial.println("s uptime");
    }
    if (context.communication.mqttConnected && !mqttNow)
    {
        context.communication.mqttDrops++;
        Serial.print("DIAG: MQTT lost (drop #");
        Serial.print(context.communication.mqttDrops);
        Serial.print("), WiFi ");
        Serial.print(wifiNow ? "still up, RSSI " : "also down, RSSI ");
        Serial.print(WiFi.RSSI());
        Serial.print(", PubSubClient state ");
        Serial.println(mqttManager.lastState());
    }

    context.communication.wifiConnected = wifiNow;
    context.communication.mqttConnected = mqttNow;

    controller.update();
    statusManager.update();
}