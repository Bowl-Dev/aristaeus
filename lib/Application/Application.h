#pragma once

#include "MachineController.h"
#include "Protocol.h"

class Application
{
public:
    Application(
        MachineController& controller,
        Protocol& protocol);

    bool processCommand(const char* json);

private:
    MachineController& controller;
    Protocol& protocol;
};