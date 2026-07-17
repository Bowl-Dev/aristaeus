#pragma once

#include "IManager.h"
#include "MachineContext.h"

class MQTTManager : public IManager
{
public:

    explicit MQTTManager(MachineContext& context);

    void begin() override;

    void update() override;

private:

    MachineContext& context;
};