#pragma once

#include "IManager.h"
#include "MachineContext.h"

class ServoManager : public IManager
{
public:

    explicit ServoManager(MachineContext& context);

    void begin() override;

    void update() override;

private:

    MachineContext& context;
};