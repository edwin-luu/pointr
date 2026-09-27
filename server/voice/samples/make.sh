#!/bin/sh
# Makes synthetic webm/opus test clips (the format the extension records) with
# espeak-ng + ffmpeg inside a throwaway container. Usage: sh make.sh
set -e
cd "$(dirname "$0")"
docker run --rm -v "$PWD:/out" debian:stable-slim sh -c '
  apt-get update -qq && apt-get install -y -qq espeak-ng ffmpeg >/dev/null 2>&1
  i=0
  while IFS= read -r line; do
    i=$((i+1))
    espeak-ng -s 140 -w /tmp/c.wav "$line"
    ffmpeg -loglevel error -y -i /tmp/c.wav -af "apad=pad_dur=0.8" -c:a libopus -b:a 32k /out/clip$i.webm
    echo "clip$i.webm|$line" >> /out/expected.txt
  done < /out/phrases.txt
'
