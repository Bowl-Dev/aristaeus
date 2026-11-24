#include <unity.h>
#include "Protocol.h"

void setUp() {}
void tearDown() {}

static JobRequest parse(const char* json, bool expectOk = true)
{
    JobRequest r;
    TEST_ASSERT_EQUAL(expectOk, Protocol().parse(json, r));
    return r;
}

void test_dispense()
{
    JobRequest r = parse(R"({"command":"dispense","actuator":1,"targetWeight":42.5,"speed":1500,"holdFlush":true,"id":7})");
    TEST_ASSERT_EQUAL(JobType::Dispense, r.type);
    TEST_ASSERT_EQUAL(1, r.actuator);
    TEST_ASSERT_EQUAL_FLOAT(42.5f, r.targetWeight);
    TEST_ASSERT_EQUAL(1500, r.speed);
    TEST_ASSERT_TRUE(r.holdFlush);
    TEST_ASSERT_EQUAL(7, r.id);
}

void test_dispense_defaults()
{
    JobRequest r = parse(R"({"command":"dispense","actuator":0,"targetWeight":10})");
    TEST_ASSERT_EQUAL(1000, r.speed);
    TEST_ASSERT_FALSE(r.holdFlush);
    TEST_ASSERT_EQUAL(0, r.id);
}

void test_simple_commands()
{
    TEST_ASSERT_EQUAL(JobType::Tare, parse(R"({"command":"tare","actuator":1})").type);
    TEST_ASSERT_EQUAL(JobType::Reset, parse(R"({"command":"reset","actuator":0})").type);
    TEST_ASSERT_EQUAL(JobType::Resume, parse(R"({"command":"resume","actuator":0})").type);
    TEST_ASSERT_EQUAL(JobType::Flush, parse(R"({"command":"flush","actuator":1})").type);
    TEST_ASSERT_EQUAL(1, parse(R"({"command":"tare","actuator":1})").actuator);
}

void test_calibrate_and_gate()
{
    JobRequest c = parse(R"({"command":"calibrate","actuator":0,"knownWeight":200})");
    TEST_ASSERT_EQUAL(JobType::Calibrate, c.type);
    TEST_ASSERT_EQUAL_FLOAT(200.0f, c.targetWeight);

    JobRequest g = parse(R"({"command":"gate","actuator":1,"open":true})");
    TEST_ASSERT_EQUAL(JobType::MoveServo, g.type);
    TEST_ASSERT_TRUE(g.openGate);
}

void test_rejects()
{
    parse("not json", false);
    parse(R"({"command":"status"})", false);
    parse(R"({"actuator":0})", false);
}

int main()
{
    UNITY_BEGIN();
    RUN_TEST(test_dispense);
    RUN_TEST(test_dispense_defaults);
    RUN_TEST(test_simple_commands);
    RUN_TEST(test_calibrate_and_gate);
    RUN_TEST(test_rejects);
    return UNITY_END();
}
