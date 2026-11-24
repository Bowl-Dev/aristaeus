#pragma once

class StepperManager;
class LoadCellManager;
class ServoManager;

struct MachineServices
{
    StepperManager& stepper;
    LoadCellManager& loadCell;
    ServoManager& servo;
};
