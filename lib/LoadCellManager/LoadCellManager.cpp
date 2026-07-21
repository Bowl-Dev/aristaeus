#include "LoadCellManager.h"

LoadCellManager::LoadCellManager(MachineContext& ctx)
    : context(ctx)
{
}

void LoadCellManager::begin()
{
}

void LoadCellManager::update()
{
    context.loadCell[0].weight += 0.25f;
}

float LoadCellManager::getWeight(uint8_t channel) const
{
    if (channel >= 2)
        return 0.0f;

    return context.loadCell[channel].weight;
}