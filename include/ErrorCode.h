#pragma once

enum class ErrorCode
{
    Ok = 0,

    InvalidCommand,

    InvalidTarget,

    InvalidParameter,

    Busy,

    NotReady,

    HardwareError,

    CommunicationError,

    Timeout,

    UnknownError
};