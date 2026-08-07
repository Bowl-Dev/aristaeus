#pragma once

#include "ProtocolESP32.h"

namespace Comm
{

class PacketCodec
{
public:

    static bool encode( const Frame& frame, uint8_t* buffer, uint16_t& length);

    static bool decode( const uint8_t* buffer, uint16_t length, Frame& frame);
};

}