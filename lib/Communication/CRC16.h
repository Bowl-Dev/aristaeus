#pragma once

#include <stdint.h>

namespace Comm
{

uint16_t crc16(const uint8_t* data, uint16_t length);

}