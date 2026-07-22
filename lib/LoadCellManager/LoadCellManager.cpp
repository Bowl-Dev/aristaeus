#include "LoadCellManager.h"

LoadCellManager::LoadCellManager(MachineContext& ctx)
    : context(ctx)
{
}

void LoadCellManager::begin()
{
    for (uint8_t i = 0; i < NUM_LOAD_CELLS; i++)
    {
        scales[i].begin(
            HX711_DT_PIN[i],
            HX711_SCK_PIN[i]);
            scales[i].set_scale(1.0f);
    }   
}

void LoadCellManager::update()
{
    for (uint8_t i = 0; i < NUM_LOAD_CELLS; i++)
    {
        if (scales[i].is_ready())
        {
            int32_t raw = scales[i].read();
            context.loadCell[i].raw = raw;

            float counts = scales[i].get_value(1);
            context.loadCell[i].weight = counts /context.calibration[i].countsPerGram;            
        }
    }
}

float LoadCellManager::getWeight(uint8_t channel) const
{
    if (channel >= 2)
        return 0.0f;
    return context.loadCell[channel].weight;
}

int32_t LoadCellManager::getRaw(uint8_t channel) const
{
    if (channel >= NUM_LOAD_CELLS)
        return 0;
    return context.loadCell[channel].raw;
}

void LoadCellManager::setCountsPerGram(uint8_t channel, float countsPerGram)
{
    if (channel >= NUM_LOAD_CELLS)
        return;
        context.calibration[channel].countsPerGram = countsPerGram;
}

bool LoadCellManager::requestTare(uint8_t channel)
{
    if (channel >= NUM_LOAD_CELLS)
        return false;

    scales[channel].tare();
    context.loadCell[channel].tareComplete = true;
    return true;
}