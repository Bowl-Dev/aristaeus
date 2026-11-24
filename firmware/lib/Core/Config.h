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

// WIFI_SSID / WIFI_PASSWORD live in secrets.h (gitignored - this repo is
// public). First build: cp lib/Core/secrets.example.h lib/Core/secrets.h
#include "secrets.h"

// The broker (mosquitto + dashboard.py) runs on Juan's PC, whose IP can
// change whenever Windows renews its DHCP lease. Solved via mDNS instead of
// a fixed IP: this hostname is resolved to whatever IP the PC currently has
// at runtime (see MQTTManager::resolveBrokerAddress()), re-resolved on
// every reconnect attempt - so the firmware follows the broker to a new IP
// automatically, no reflash needed. Find the PC's hostname by running
// `hostname` in PowerShell or cmd - do NOT include ".local", queryHost()
// appends that itself. Set via platformio.ini build_flags; shared by every
// unit since they all talk to the same broker.
#ifndef MQTT_BROKER_HOSTNAME
#define MQTT_BROKER_HOSTNAME "CHANGE-ME-PC-HOSTNAME"
#endif

// Used only until the first successful mDNS resolution after boot (or if
// mDNS is ever unavailable on the network) - once resolveBrokerAddress()
// succeeds once, its result is kept from then on and this fallback is not
// consulted again unless the device reboots. Update it if you happen to
// learn the PC's current IP, as a safety net - it's a backstop now, not the
// primary mechanism.
constexpr char MQTT_SERVER_FALLBACK[] = "192.168.2.17";

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

// Two flush behaviors share this same codebase, picked per unit at build
// time via platformio.ini (see the esp32_03/esp32_04 environments):
//   off (default, esp32_01/esp32_02): each actuator opens its own gate the
//        moment IT reaches target weight - actuators are fully independent.
//   on  (esp32_03/esp32_04): an actuator that reaches target weight stops
//        its motor and waits - gates only open once every actuator that was
//        actively dispensing has also finished, and then they open together.
// Motors themselves already run in parallel either way; this flag only
// changes when the gates are allowed to open. See
// MachineController::synchronizeFlush().
#ifndef SYNCHRONIZED_FLUSH_CONFIG
#define SYNCHRONIZED_FLUSH_CONFIG 0
#endif

constexpr bool SYNCHRONIZED_FLUSH = (SYNCHRONIZED_FLUSH_CONFIG != 0);