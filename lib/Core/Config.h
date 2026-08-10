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
    uint8_t closedAngle;
    uint8_t openAngle;
};

constexpr char WIFI_SSID[] = "REDACTED";
constexpr char WIFI_PASSWORD[] = "REDACTED";

constexpr char MQTT_SERVER[] = "192.168.2.9";   // Your broker IP
constexpr uint16_t MQTT_PORT = 1883;

#ifndef DEVICE_ID
#define DEVICE_ID "esp32-default"   // overridden per unit via platformio.ini build_flags
#endif

constexpr char MQTT_CLIENT_ID[] = DEVICE_ID;

constexpr char MQTT_COMMAND_TOPIC[] = "machine/" DEVICE_ID "/command";
constexpr char MQTT_STATUS_TOPIC[]  = "machine/" DEVICE_ID "/status";
constexpr char MQTT_EVENT_TOPIC[] = "machine/" DEVICE_ID "/event";

// Each actuator on a unit dispenses its own ingredient - set per unit via
// platformio.ini build_flags, same mechanism as DEVICE_ID.
#ifndef INGREDIENT_ACTUATOR_0
#define INGREDIENT_ACTUATOR_0 "unknown"
#endif

#ifndef INGREDIENT_ACTUATOR_1
#define INGREDIENT_ACTUATOR_1 "unknown"
#endif

constexpr const char* INGREDIENT_NAMES[2] = { INGREDIENT_ACTUATOR_0, INGREDIENT_ACTUATOR_1 };