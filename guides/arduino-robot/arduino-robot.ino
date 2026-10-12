// First stage: distance sensing. Motor hardware is not included in this catalog set.
constexpr int TRIG_PIN = 9;
constexpr int ECHO_PIN = 10;
void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
}
void loop() {
  digitalWrite(TRIG_PIN, LOW); delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  unsigned long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) Serial.println("No echo");
  else {
    float distanceCm = duration * 0.0343f / 2.0f;
    Serial.print("Distance (cm): "); Serial.println(distanceCm);
    Serial.println(distanceCm < 20 ? "Obstacle: stop" : "Path clear");
  }
  delay(150);
}
