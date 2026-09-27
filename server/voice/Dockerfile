# Pointr voice helper: faster-whisper behind a tiny HTTP API (ARCHITECTURE 13).
# The model is downloaded at BUILD time so the container runs offline.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    HF_HOME=/models

RUN pip install faster-whisper fastapi uvicorn

ARG WHISPER_MODEL=base.en
ENV WHISPER_MODEL=${WHISPER_MODEL}
RUN python -c "import os; from faster_whisper import WhisperModel; WhisperModel(os.environ['WHISPER_MODEL'], device='cpu', compute_type='int8')"

WORKDIR /app
COPY app.py .

EXPOSE 8790
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8790", "--log-level", "warning"]
