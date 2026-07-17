#pragma once

#include "MachineContext.h"

#include "StepperManager.h"
#include "LoadCellManager.h"
#include "ServoManager.h"
#include "WiFiManager.h"
#include "MQTTManager.h"
#include "SafetyManager.h"

class MachineController
{
public:

    MachineController(
        MachineContext& context,
        StepperManager& steppers,
        LoadCellManager& loadCells,
        ServoManager& servos,
        WifiManager& wifi,
        MQTTManager& mqtt,
        SafetyManager& safety);

    void begin();

    void update();

private:

    MachineContext& context;

    StepperManager& steppers;
    LoadCellManager& loadCells;
    ServoManager& servos;
    WifiManager& wifi;
    MQTTManager& mqtt;
    SafetyManager& safety;
};