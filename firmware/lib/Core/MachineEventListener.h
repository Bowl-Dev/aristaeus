// Listener that can send messages to different channels (serial monitor, mqtt, etc.)

#pragma once

#include "MachineEvent.h"

class MachineEventListener
{
public:

    virtual ~MachineEventListener() = default;

    virtual void onMachineEvent(const MachineEvent& event) = 0;
};