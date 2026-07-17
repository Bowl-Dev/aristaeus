#pragma once

class IManager
{
public:

    virtual ~IManager() = default;

    virtual void begin() = 0;

    virtual void update() = 0;
};