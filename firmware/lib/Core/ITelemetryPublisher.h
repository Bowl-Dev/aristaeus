#pragma once

// Publishes status snapshots and machine events over whatever transport is
// currently wired in (MQTT today, RS-485 later). Callers depend on this
// interface, never on a concrete transport class.
class ITelemetryPublisher
{
public:

    virtual ~ITelemetryPublisher() = default;

    virtual bool publishStatus(const char* payload) = 0;

    virtual bool publishEvent(const char* payload) = 0;
};