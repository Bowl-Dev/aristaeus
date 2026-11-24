#pragma once

#include <WiFi.h>

class WifiManager
{
public:

    void begin();

    void update();

    bool connected() const;

private:

    void reconnect();
    bool wasConnected = false;
    uint32_t lastReconnectAttempt = 0;
    static constexpr uint32_t RECONNECT_INTERVAL_MS = 5000;
};