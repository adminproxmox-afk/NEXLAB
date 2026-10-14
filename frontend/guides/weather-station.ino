#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>
#include <Wire.h>
constexpr int DHT_PIN = 17;
DHT dht(DHT_PIN, DHT22);
Adafruit_SSD1306 display(128, 64, &Wire, -1);
void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  dht.begin();
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED not found. Check wiring and I2C address.");
    while (true)
      delay(1000);
  }
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
}
void loop() {
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  display.clearDisplay();
  display.setCursor(0, 0);
  if (isnan(temperature) || isnan(humidity)) {
    display.println("DHT read error");
  } else {
    display.print("Temperature: ");
    display.print(temperature, 1);
    display.println(" C");
    display.print("Humidity: ");
    display.print(humidity, 1);
    display.println(" %");
  }
  display.display();
  delay(2200);
}
