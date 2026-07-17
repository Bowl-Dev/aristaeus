#pragma once

#include "IManager.h"
#include "MachineContext.h"

class SafetyManager : public IManager
{
public:

    explicit SafetyManager(MachineContext& context);

    void begin() override;

    void update() override;

private:

    MachineContext& context;
};