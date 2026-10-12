#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
WebServer server(80);
Adafruit_SSD1306 display(128, 64, &Wire, -1);
bool enabled = false;
void showState() {
  display.clearDisplay(); display.setCursor(0, 0);
  display.println("NEXLAB Controller");
  display.println(enabled ? "State: ON" : "State: OFF");
  display.println(WiFi.softAPIP()); display.display();
}
void setup() {
  Wire.begin(21, 22);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) while (true) delay(1000);
  display.setTextColor(SSD1306_WHITE); display.setTextSize(1);
  WiFi.softAP("NEXLAB-Control", "change-this-password");
  server.on("/", HTTP_GET, []() {server.send(200, "text/html", "<h1>Controller</h1><form method='post' action='/toggle'><button>Toggle state</button></form>");});
  server.on("/toggle", HTTP_POST, []() {enabled = !enabled; showState(); server.sendHeader("Location", "/"); server.send(303);});
  server.begin(); showState();
}
void loop() {server.handleClient();}
