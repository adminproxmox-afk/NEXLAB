constexpr int PIR_PIN = 2;
constexpr int BUZZER_PIN = 8;
constexpr unsigned long PIR_WARMUP_MS = 30000;

unsigned long startedAt = 0;
int lastMotionState = LOW;

void setup() {
  pinMode(PIR_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  Serial.begin(9600);
  startedAt = millis();
  Serial.println("PIR is stabilizing; please wait about 30 seconds.");
}

void loop() {
  if (millis() - startedAt < PIR_WARMUP_MS) {
    digitalWrite(BUZZER_PIN, LOW);
    delay(50);
    return;
  }

  const int motionState = digitalRead(PIR_PIN);
  digitalWrite(BUZZER_PIN, motionState == HIGH ? HIGH : LOW);

  if (motionState != lastMotionState) {
    Serial.println(motionState == HIGH ? "Motion detected" : "Area clear");
    lastMotionState = motionState;
  }

  delay(50);
}
