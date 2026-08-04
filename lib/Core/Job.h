#pragma once

struct ServiceContainer;

class Job
{
public:

    virtual ~Job() = default;

    virtual void begin(ServiceContainer& services) = 0;

    virtual void update(ServiceContainer& services) = 0;

    virtual bool finished() const = 0;
};