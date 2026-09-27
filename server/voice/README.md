# Voice helper (Whisper)

Local speech-to-text for Pointr's push-to-talk (ARCHITECTURE 13). faster-whisper `base.en`, int8 on CPU, 8 threads, VAD on, demo vocabulary as the initial prompt. The model is downloaded when the image is built, so it runs offline.

- Start: `cd server && docker compose up -d --build whisper` (listens on `127.0.0.1:8790`).
- Health: `curl -s localhost:8790/health`
- Try a clip directly: `curl -s -X POST --data-binary @voice/samples/clip1.webm -H "Content-Type: audio/webm" localhost:8790/transcribe` -> `{"text": "...", "ms": 800}`
- Through the backend (what the extension uses): same with `localhost:8787/transcribe` -> `{"ok": true, "text": "...", "latencyMs": 900}`
- Another model: `WHISPER_MODEL=small.en docker compose build whisper` (slower, more accurate).

`samples/` holds synthetic test clips (espeak-ng voice, webm/opus like the extension records): `sh samples/make.sh` regenerates them from `samples/phrases.txt`; `goal-*.wav` feed the robot tester's fake microphone (`scripts/e2e/voice.mjs`).

Measured on a laptop CPU (3.5-6.4 s clips, through the backend): p50 835 ms, p90 889 ms.
