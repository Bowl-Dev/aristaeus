#pragma once

#include <stdint.h>

struct StepperConfig
{
    uint8_t stepPin;
    uint8_t dirPin;
    uint8_t enablePin;
};

struct LoadCellConfig
{
    uint8_t doutPin;
    uint8_t sckPin;
    float calibrationFactor;
};

struct ServoConfig
{
    uint8_t pin;
    uint16_t minPulse;
    uint16_t maxPulse;
};

constexpr char WIFI_SSID[] = "REDACTED";

constexpr char WIFI_PASSWORD[] = "REDACTED";