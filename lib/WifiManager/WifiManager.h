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

    uint32_t lastReconnectAttempt = 0;
};