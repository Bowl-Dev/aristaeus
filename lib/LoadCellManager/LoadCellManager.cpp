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

    loadCalibration();
}

void LoadCellManager::loadCalibration()
{
    // Read-only open - each channel falls back to whatever Calibration.h's
    // default (700.0f) already put in context.calibration[i] if it was
    // never calibrated before.
    Preferences prefs;
    prefs.begin("loadcell", true);

    for (uint8_t i = 0; i < NUM_LOAD_CELLS; i++)
    {
        char key[8];
        snprintf(key, sizeof(key), "cal%u", i);

        float saved = prefs.getFloat(key, context.calibration[i].countsPerGram);
        context.calibration[i].countsPerGram = saved;
    }

    prefs.end();
}

void LoadCellManager::saveCalibration(uint8_t channel, float countsPerGram)
{
    Preferences prefs;
    prefs.begin("loadcell", false);

    char key[8];
    snprintf(key, sizeof(key), "cal%u", channel);
    prefs.putFloat(key, countsPerGram);

    prefs.end();
}

void LoadCellManager::update()
{
    for (uint8_t i = 0; i < NUM_LOAD_CELLS; i++)
    {
        if (scales[i].is_ready())
        {
            int32_t raw = scales[i].read();
            context.loadCell[i].raw = raw;
            
            float counts = static_cast<float>(raw) - scales[i].get_offset();
            context.loadCell[i].weight = counts / context.calibration[i].countsPerGram;
        }
    }
}

float LoadCellManager::getWeight(uint8_t channel) const
{
    if (channel >= NUM_LOAD_CELLS)
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
    saveCalibration(channel, countsPerGram);
}

bool LoadCellManager::calibrate(uint8_t channel, float knownWeightGrams)
{
    if (channel >= NUM_LOAD_CELLS)
        return false;

    if (knownWeightGrams <= 0.0f)
        return false;

    constexpr uint32_t CALIBRATE_TIMEOUT_MS = 1000;

    if (!scales[channel].wait_ready_timeout(CALIBRATE_TIMEOUT_MS))
        return false;

    // Same offset-corrected counts LoadCellManager::update() uses for
    // weight - read() gives the raw ADC value, get_offset() is whatever
    // the last tare() recorded as zero.
    int32_t raw = scales[channel].read();
    float counts = static_cast<float>(raw) - scales[channel].get_offset();
    float factor = counts / knownWeightGrams;

    // A sane calibration factor is always positive - zero/negative means
    // the tray wasn't tared first, the weight is on backwards, or there's
    // nothing on it at all.
    if (factor <= 0.0f)
        return false;

    context.calibration[channel].countsPerGram = factor;
    saveCalibration(channel, factor);

    Serial.print("Load cell ");
    Serial.print(channel);
    Serial.print(" calibrated: ");
    Serial.print(factor);
    Serial.println(" counts/gram");

    return true;
}

bool LoadCellManager::requestTare(uint8_t channel)
{
    if (channel >= NUM_LOAD_CELLS)
        return false;

    constexpr uint32_t TARE_TIMEOUT_MS = 1000;

    if (!scales[channel].wait_ready_timeout(TARE_TIMEOUT_MS))
    {
        Serial.print("Load cell ");
        Serial.print(channel);
        Serial.println(" not responding, skipping tare");

        context.loadCell[channel].connected = false;
        return false;
    }

    scales[channel].tare();
    context.loadCell[channel].connected = true;
    context.loadCell[channel].tareComplete = true;
    return true;
}