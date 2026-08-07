#pragma once

#include "IManager.h"
#include "MachineContext.h"  //Hardware and connection updates
#include "MachineController.h" //State and Job updates
#include "ITelemetryPublisher.h" //Publishes messages between machines 

class StatusManager : public IManager
{
public:

    explicit StatusManager(MachineContext& context, MachineController& controller, ITelemetryPublisher& telemetry);

    void begin() override;

    void update() override;

private:

    MachineContext& context;
    MachineController& controller;
    ITelemetryPublisher& telemetry;
    uint32_t lastPublish = 0;
};