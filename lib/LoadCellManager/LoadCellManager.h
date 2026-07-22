#pragma once

#include "IManager.h"
#include "MachineContext.h"
#include <HX711.h>
#include "Pins.h"

class LoadCellManager : public IManager
{
public:

    explicit LoadCellManager(MachineContext& context);

    void begin() override;
    void update() override;
    float getWeight(uint8_t channel) const;
    int32_t getRaw(uint8_t channel) const;
    void setCountsPerGram(uint8_t channel, float countsPerGram);
    bool requestTare(uint8_t channel);

private:

    MachineContext& context;
    HX711 scales[NUM_LOAD_CELLS];        
};