#pragma once

#include "IManager.h"
#include "MachineContext.h"

class LoadCellManager : public IManager
{
public:

    explicit LoadCellManager(MachineContext& context);

    void begin() override;

    void update() override;

private:

    MachineContext& context;
};