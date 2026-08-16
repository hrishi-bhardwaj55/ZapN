# Telemetry

Every important behavioral action uses:

```json
{
  "sessionId": "series-...",
  "gameId": "code-compare",
  "round": 4,
  "eventType": "USER_RESPONSE",
  "timestamp": 9876.54,
  "payload": {}
}
```

Supported shared events include `GAME_STARTED`, `ROUND_STARTED`, `STIMULUS_SHOWN`, `USER_RESPONSE`, `CORRECT_RESPONSE`, `INCORRECT_RESPONSE`, `TIMEOUT`, `ROUND_COMPLETED`, `GAME_COMPLETED`, `LEVEL_CHANGED`, `DIFFICULTY_CHANGED`, and `FOCUS_LOST`.

Client timestamps are monotonic `performance.now()` values. Attempt start/completion fields use ISO wall-clock time. Focus loss is annotated, never framed as an accusation. Telemetry remains local in account-free mode and is included in JSON export. A synchronized client should upload after each round or every 10–25 events so network latency cannot affect gameplay. Canvas animation frames are deliberately excluded.
