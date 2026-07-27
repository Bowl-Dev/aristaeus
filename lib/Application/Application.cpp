#include "Application.h"

Application::Application(
    MachineController& controller,
    Protocol& protocol)
    : controller(controller),
      protocol(protocol)
{
}

bool Application::processCommand(const char* json)
{
    JobRequest request;

    if (!protocol.parse(json, request))
        return false;

    return controller.enqueueJob(request);
}