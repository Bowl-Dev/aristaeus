#include <doctest.h>
#include "Command.h"

TEST_CASE("Default command is initialized correctly")
{
    Command cmd;

    CHECK(cmd.type == CommandType::None);

    CHECK(cmd.target == 0);

    CHECK(cmd.value == 0);

    CHECK(cmd.valueFloat == doctest::Approx(0.0f));

    CHECK(cmd.flag == false);

    CHECK(cmd.timestamp == 0);
}