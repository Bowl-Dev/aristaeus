#pragma once

#include "MachineEventListener.h"
#include "ITelemetryPublisher.h"

class MQTTEventListener : public MachineEventListener
{
public:

    explicit MQTTEventListener(ITelemetryPublisher& telemetry);

    void onMachineEvent(const MachineEvent& event) override;

private:

    ITelemetryPublisher& telemetry;
};