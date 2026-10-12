#include <DHT.h>
// Check the actual module schematic before changing RELAY_PIN or ACTIVE_LEVEL.
constexpr int RELAY_PIN = 16;
constexpr int ACTIVE_LEVEL = LOW;
constexpr int DHT_PIN = 17;
DHT dht(DHT_PIN, DHT22);
void setup() {
  digitalWrite(RELAY_PIN, ACTIVE_LEVEL == HIGH ? LOW : HIGH);
  pinMode(RELAY_PIN, OUTPUT);
  Serial.begin(115200);
  dht.begin();
}
void loop() {
  float temperature = dht.readTemperature();
  bool activate = !isnan(temperature) && temperature > 28;
  digitalWrite(RELAY_PIN,
               activate ? ACTIVE_LEVEL : (ACTIVE_LEVEL == HIGH ? LOW : HIGH));
  Serial.print("Temperature: ");
  Serial.println(temperature);
  delay(2200);
}
