#pragma once

#include "MachineContext.h"  //Hardware and connection updates
#include "MachineController.h" //State and Job updates
#include "ITelemetryPublisher.h" //Publishes messages between machines 

// Why the ESP32 last (re)booted: "PowerOn", "Brownout" (supply voltage dipped
// - typically servo/stepper current spikes), "Panic" (crash), "TaskWDT" /
// "IntWDT" (main loop blocked too long), "Software", ... Shown in the status
// message and printed at boot, to tell crashes and power problems apart from
// plain WiFi dropouts.
const char* resetReasonToString();

class StatusManager
{
public:

    explicit StatusManager(MachineContext& context, MachineController& controller, ITelemetryPublisher& telemetry);

    void update();

private:

    MachineContext& context;
    MachineController& controller;
    ITelemetryPublisher& telemetry;
    uint32_t lastPublish = 0;
};