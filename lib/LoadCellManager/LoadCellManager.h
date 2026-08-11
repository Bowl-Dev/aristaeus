#pragma once

#include "IManager.h"
#include "MachineContext.h"
#include <HX711.h>
#include <Preferences.h>
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

    // Computes counts-per-gram for this channel from whatever known weight
    // is currently on the tray (call requestTare() first, then place the
    // weight), and persists it to flash (NVS) so it survives reboots -
    // recalibrating never requires reflashing.
    bool calibrate(uint8_t channel, float knownWeightGrams);

private:

    void loadCalibration();
    void saveCalibration(uint8_t channel, float countsPerGram);

    MachineContext& context;
    HX711 scales[NUM_LOAD_CELLS];
};