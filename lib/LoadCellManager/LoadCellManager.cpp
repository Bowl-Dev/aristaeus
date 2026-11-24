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

    // HX711::tare() averages 10 reads, and every read() waits FOREVER for the
    // chip to signal "ready" - with a flaky wire or noisy supply that froze
    // the whole main loop (and with it MQTT keepalives) for seconds. Take the
    // same kind of average ourselves, but never wait more than
    // TARE_MAX_MS in total, and only use samples the chip actually has ready.
    constexpr uint32_t TARE_MAX_MS = 800;
    constexpr uint8_t TARE_SAMPLES = 5;

    uint32_t tareStart = millis();
    int64_t sum = 0;
    uint8_t samples = 0;

    while (samples < TARE_SAMPLES && millis() - tareStart < TARE_MAX_MS)
    {
        if (scales[channel].is_ready())
        {
            sum += scales[channel].read();
            samples++;
        }
        else
        {
            delay(1);
        }
    }

    if (samples == 0)
    {
        Serial.print("Load cell ");
        Serial.print(channel);
        Serial.println(" gave no samples during tare, skipping");
        context.loadCell[channel].connected = false;
        return false;
    }

    scales[channel].set_offset(static_cast<long>(sum / samples));

    uint32_t tareMs = millis() - tareStart;
    if (tareMs > 300)
    {
        Serial.print("DIAG: tare of channel ");
        Serial.print(channel);
        Serial.print(" took ");
        Serial.print(tareMs);
        Serial.println(" ms");
    }

    // tare() only updates the HX711 wrapper's internal zero-offset - the
    // cached context.loadCell[channel].weight (what MachineController
    // actually compares against target weight) doesn't get recomputed
    // until the next update() tick sees a fresh is_ready() sample, which
    // can be tens to ~100ms away. If a dispense job starts before that
    // tick - e.g. right after this tare, as the recipe flow does - it
    // would read the STALE pre-tare weight (a bowl already on the tray)
    // and think it already hit target instantly. Zero it here so there's
    // no window where a fresh tare leaves a stale non-zero reading behind.
    context.loadCell[channel].weight = 0.0f;
    context.loadCell[channel].raw = scales[channel].get_offset();

    context.loadCell[channel].connected = true;
    context.loadCell[channel].tareComplete = true;
    return true;
}