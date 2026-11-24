#include "WifiManager.h"
#include "Config.h"
#include "MachineContext.h"

void WifiManager::begin()
{
    WiFi.mode(WIFI_STA);

    // Keep the radio awake: the default modem power-save naps between router
    // beacons and, on a weak link, makes the unit miss packets (MQTT replies
    // included) until the broker connection times out (PubSubClient -4).
    WiFi.setSleep(false);
    WiFi.setAutoReconnect(true);
    WiFi.setTxPower(WIFI_POWER_19_5dBm);

    Serial.printf("Connecting to %s...\n", WIFI_SSID);

    WiFi.begin(WIFI_SSID,WIFI_PASSWORD);    
}

bool WifiManager::connected() const
{
    return WiFi.status() == WL_CONNECTED;
}

IPAddress WifiManager::localIP() const
{
    return WiFi.localIP();
}

void WifiManager::update()
{
    if (connected())
    {
        if (!wasConnected)
        {
            wasConnected = true;
            Serial.print("WiFi connected: ");
            Serial.println(WiFi.localIP());
        }
        return;
    }

    if (wasConnected)
    {
        wasConnected = false;
        Serial.println("WiFi disconnected");
    }
    reconnect();    
}

void WifiManager::reconnect()
{
    uint32_t now = millis();

    if (now - lastReconnectAttempt < RECONNECT_INTERVAL_MS)
        return;

    lastReconnectAttempt = now;

    Serial.println("Reconnecting WiFi...");

    WiFi.disconnect();

    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}