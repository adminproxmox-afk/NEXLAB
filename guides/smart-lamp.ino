#include <WiFi.h>
#include <WebServer.h>
#include <FastLED.h>
constexpr int DATA_PIN = 18;
constexpr int LED_COUNT = 60;
CRGB leds[LED_COUNT];
WebServer server(80);
void setup() {
  Serial.begin(115200);
  FastLED.addLeds<WS2812B, DATA_PIN, GRB>(leds, LED_COUNT);
  FastLED.setBrightness(32);
  FastLED.setMaxPowerInVoltsAndMilliamps(5, 1000);
  FastLED.clear(true);
  WiFi.softAP("NEXLAB-Lamp", "change-this-password");
  Serial.println(WiFi.softAPIP());
  server.on("/", HTTP_GET, []() {
    server.send(200, "text/html", "<h1>NEXLAB Lamp</h1><form method='post' action='/on'><button>On</button></form><form method='post' action='/off'><button>Off</button></form>");
  });
  server.on("/on", HTTP_POST, []() {fill_solid(leds, LED_COUNT, CRGB::Orange); FastLED.show(); server.sendHeader("Location", "/"); server.send(303);});
  server.on("/off", HTTP_POST, []() {FastLED.clear(true); server.sendHeader("Location", "/"); server.send(303);});
  server.begin();
}
void loop() {server.handleClient();}
