#pragma once

#include "MachineEventListener.h"
#include "MQTTManager.h"

class MQTTEventListener : public MachineEventListener
{
public:

    explicit MQTTEventListener(MQTTManager& mqtt);

    void onMachineEvent(const MachineEvent& event) override;

private:

    MQTTManager& mqttManager;
};