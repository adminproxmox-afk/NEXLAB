#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

constexpr int SOIL_PIN = 34;  // ADC1 input on ESP32
constexpr int SCREEN_WIDTH = 128;
constexpr int SCREEN_HEIGHT = 64;
constexpr int OLED_RESET = -1;
constexpr int OLED_ADDRESS = 0x3C;

// Replace these example values with readings from your own sensor.
constexpr int DRY_VALUE = 3000;
constexpr int WET_VALUE = 1400;
constexpr int DRY_THRESHOLD_PERCENT = 30;

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);

  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS)) {
    Serial.println("OLED not found: check I2C wiring and address.");
    while (true) delay(100);
  }

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("Soil monitor ready");
  display.display();
  delay(1000);
}

void loop() {
  const int rawValue = analogRead(SOIL_PIN);
  const int boundedValue = constrain(rawValue, WET_VALUE, DRY_VALUE);
  const int moisturePercent = map(boundedValue, DRY_VALUE, WET_VALUE, 0, 100);
  const bool needsWater = moisturePercent < DRY_THRESHOLD_PERCENT;

  Serial.print("ADC: ");
  Serial.print(rawValue);
  Serial.print(" | moisture: ");
  Serial.print(moisturePercent);
  Serial.println("% (approximate)");

  display.clearDisplay();
  display.setCursor(0, 0);
  display.setTextSize(1);
  display.println("SOIL MOISTURE");
  display.println();
  display.setTextSize(2);
  display.print(moisturePercent);
  display.println("%");
  display.setTextSize(1);
  display.println(needsWater ? "Check the soil" : "Level looks OK");
  display.print("ADC: ");
  display.println(rawValue);
  display.display();

  delay(1000);
}
