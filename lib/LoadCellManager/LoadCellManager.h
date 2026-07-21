#pragma once

#include "IManager.h"
#include "MachineContext.h"

class LoadCellManager : public IManager
{
public:

    explicit LoadCellManager(MachineContext& context);

    void begin() override;
    void update() override;
    float getWeight(uint8_t channel) const;

private:

    MachineContext& context;
};