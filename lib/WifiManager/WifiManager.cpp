#include "WifiManager.h"
#include "Config.h"
#include "MachineContext.h"

void WifiManager::begin()
{
    WiFi.mode(WIFI_STA);

    WiFi.begin(
        WIFI_SSID,
        WIFI_PASSWORD);

    Serial.println("Connecting to WiFi...");
}

bool WifiManager::connected() const
{
    return WiFi.status() == WL_CONNECTED;
}

void WifiManager::reconnect()
{
    Serial.println("Reconnecting WiFi...");

    WiFi.disconnect();

    WiFi.begin(
        WIFI_SSID,
        WIFI_PASSWORD);
}

void WifiManager::update()
{
    if (connected())
        return;

    if (millis() - lastReconnectAttempt < 5000)
        return;

    lastReconnectAttempt = millis();

    reconnect();
}