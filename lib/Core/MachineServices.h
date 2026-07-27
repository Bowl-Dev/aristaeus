#pragma once

class StepperManager;
class LoadCellManager;
class ServoManager;
//class MQTTManager;
class WifiManager;
class SafetyManager;

struct MachineServices
{
    StepperManager& stepper;
    LoadCellManager& loadCell;
    ServoManager& servo;
    //MQTTManager& mqtt;
    WifiManager& wifi;
    SafetyManager& safety;
};