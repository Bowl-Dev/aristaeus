#pragma once

#include "IManager.h"
#include "MachineContext.h"

class WifiManager : public IManager
{
public:

    explicit WifiManager(MachineContext& context);

    void begin() override;

    void update() override;

private:

    MachineContext& context;
};