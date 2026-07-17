#pragma once

#include "IManager.h"
#include "MachineContext.h"

class Logger : public IManager
{
public:

    explicit Logger(MachineContext& context);

    void begin() override;

    void update() override;

private:

    MachineContext& context;
};