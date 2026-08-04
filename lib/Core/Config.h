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

constexpr char MQTT_SERVER[] = "192.168.2.8";   // Your broker IP
constexpr uint16_t MQTT_PORT = 1883;

constexpr char MQTT_CLIENT_ID[] = "MachineController";

constexpr char MQTT_COMMAND_TOPIC[] = "machine/command";
constexpr char MQTT_STATUS_TOPIC[]  = "machine/status";
constexpr char MQTT_EVENT_TOPIC[] = "machine/event";