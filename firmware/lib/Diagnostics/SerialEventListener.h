// Event listener for the serial monitor
#pragma once

#include "MachineEventListener.h"

class SerialEventListener : public MachineEventListener
{
public:

    void onMachineEvent(const MachineEvent& event) override;
};