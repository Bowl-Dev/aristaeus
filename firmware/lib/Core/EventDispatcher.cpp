#include "EventDispatcher.h"

void EventDispatcher::addListener(MachineEventListener* listener)
{
    if (listenerCount >= MAX_LISTENERS)
        return;

    listeners[listenerCount++] = listener;
}

void EventDispatcher::onMachineEvent(const MachineEvent& event)
{
    for (uint8_t i = 0; i < listenerCount; ++i)
    {
        listeners[i]->onMachineEvent(event);
    }
}