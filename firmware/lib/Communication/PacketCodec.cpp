#include "PacketCodec.h"
#include "CRC16.h"

namespace Comm
{

bool PacketCodec::encode(const Frame& frame, uint8_t* buffer, uint16_t& length)
{
    if(frame.length > MAX_PAYLOAD_SIZE)
        return false;

    uint16_t index = 0;

    buffer[index++] = SOF;

    buffer[index++] = frame.address;

    buffer[index++] = frame.sequence >> 8;
    buffer[index++] = frame.sequence & 0xFF;

    buffer[index++] = static_cast<uint8_t>(frame.command);

    buffer[index++] = frame.length;

    for(uint8_t i=0;i<frame.length;i++)
        buffer[index++] = frame.payload[i];

    uint16_t crc =
        crc16(buffer + 1, index - 1);

    buffer[index++] = crc >> 8;
    buffer[index++] = crc & 0xFF;

    length = index;

    return true;
}

bool PacketCodec::decode(const uint8_t*, uint16_t, Frame&)
{
    return false;
}
}