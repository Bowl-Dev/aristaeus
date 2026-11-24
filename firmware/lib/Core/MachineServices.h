#pragma once

class StepperManager;
class LoadCellManager;
class ServoManager;
class WifiManager;
class SafetyManager;

struct MachineServices
{
    StepperManager& stepper;
    LoadCellManager& loadCell;
    ServoManager& servo;    
    WifiManager& wifi;
    SafetyManager& safety;
};