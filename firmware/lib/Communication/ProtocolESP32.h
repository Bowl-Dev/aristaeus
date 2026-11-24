#pragma once

#include <stdint.h>

namespace Comm
{

constexpr uint8_t SOF = 0x7E;
constexpr uint8_t BROADCAST_ADDRESS = 0xFF;
constexpr uint8_t MAX_PAYLOAD_SIZE = 32;

enum class Command : uint8_t
{
    Ping            = 1,
    Status          = 2,
    ExecuteJob      = 3,
    Stop            = 4,
    Reset           = 5,
    Tare            = 6,
    Home            = 7,

    Ack             = 8,
    Done            = 9,
    Error           = 10,
    StatusReport    = 11,
    Heartbeat       = 12
};

struct Frame
{
    uint8_t sof = SOF;
    uint8_t address = 0;
    uint16_t sequence = 0;
    Command command = Command::Ping;
    uint8_t length = 0;
    uint8_t payload[MAX_PAYLOAD_SIZE]{};
    uint16_t crc = 0;
};

}