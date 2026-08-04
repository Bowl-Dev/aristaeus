#pragma once

#include "IManager.h"
#include "MachineContext.h"  //Hardware and connection updates
#include "MachineController.h" //State and Job updates
#include "MQTTManager.h" //Publishes messages between machines 

class StatusManager : public IManager
{
public:

    explicit StatusManager(MachineContext& context, MachineController& controller, MQTTManager& mqttManager);

    void begin() override;

    void update() override;

private:

    MachineContext& context;
    MachineController& controller;
    MQTTManager& mqttManager;
    uint32_t lastPublish = 0;
};