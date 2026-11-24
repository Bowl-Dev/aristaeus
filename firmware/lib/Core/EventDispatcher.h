//Creates and array of listeners that can send messages to multiple channels

#pragma once

#include <stdint.h>
#include "MachineEventListener.h"

class EventDispatcher : public MachineEventListener
{
public:

    static constexpr uint8_t MAX_LISTENERS = 8;

    void addListener(MachineEventListener* listener);

    void onMachineEvent(const MachineEvent& event) override;

private:

    MachineEventListener* listeners[MAX_LISTENERS] = {};

    uint8_t listenerCount = 0;
};