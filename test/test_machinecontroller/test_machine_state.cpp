#include <doctest.h>

#include "MachineState.h"

TEST_CASE("Machine starts in Booting mode")
{
    MachineState state;

    CHECK(state.mode == MachineMode::Booting);
}