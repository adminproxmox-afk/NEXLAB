// Pin configuration for Heltec WiFi Kit 32 V1/V2 only. Other revisions differ.
#include <Wire.h>
#include <DHT.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
constexpr int OLED_SDA = 4, OLED_SCL = 15, OLED_RESET = 16;
constexpr int DHT_PIN = 17;
DHT dht(DHT_PIN, DHT22);
Adafruit_SSD1306 display(128, 64, &Wire, OLED_RESET);
void setup() {
  Serial.begin(115200);
  Wire.begin(OLED_SDA, OLED_SCL);
  dht.begin();
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) while (true) delay(1000);
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
}
void loop() {
  float t = dht.readTemperature(), h = dht.readHumidity();
  display.clearDisplay(); display.setCursor(0, 0);
  if (isnan(t) || isnan(h)) display.println("Sensor error");
  else {display.print(t, 1); display.println(" C"); display.print(h, 1); display.println(" %");}
  display.display(); delay(2200);
}
