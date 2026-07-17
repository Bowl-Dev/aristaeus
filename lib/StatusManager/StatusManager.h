#pragma once

#include "IManager.h"
#include "MachineContext.h"

class StatusManager : public IManager
{
public:

    explicit StatusManager(MachineContext& context);

    void begin() override;

    void update() override;

private:

    MachineContext& context;
};