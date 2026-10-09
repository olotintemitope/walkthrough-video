#!/bin/bash
# webm -> MP4, H.264 + faststart, ready for voiceover or upload.
#
# Orientation follows the capture rather than a flag: a phone profile records portrait and is
# delivered 1080x1920, a desktop capture lands 1920x1080. That distinction matters - a 16:9
# desktop app forced into a 9:16 frame renders at about 56% inside deep bands and is unreadable
# on the phone it was cropped for. Film mobile to get mobile.
#
# The app is scaled to fit and padded, never stretched, so nothing is distorted.
#
#   encode.sh <source.webm> <name> [viewport.json] [outdir] [bg]
set -e
SRC="$1"; NAME="$2"; VIEW="$3"; OUT="${4:-./mp4}"; BG="${5:-0xEAEDED}"
mkdir -p "$OUT"

# Crop off the dead strip a mid-recording resize can leave behind.
CROP=""
if [ -n "$VIEW" ] && [ -f "$VIEW" ]; then
  W=$(python3 -c "import json;print(json.load(open('$VIEW'))['w'])")
  H=$(python3 -c "import json;print(json.load(open('$VIEW'))['h'])")
  CROP="crop=${W}:${H}:0:0,"
fi

SW=$(ffprobe -v error -select_streams v -show_entries stream=width -of csv=p=0 "$SRC")
SH=$(ffprobe -v error -select_streams v -show_entries stream=height -of csv=p=0 "$SRC")
if [ "$SH" -gt "$SW" ]; then TW=1080; TH=1920; else TW=1920; TH=1080; fi

ffmpeg -nostdin -loglevel error -y -i "$SRC" \
  -vf "${CROP}scale=${TW}:${TH}:force_original_aspect_ratio=decrease,pad=${TW}:${TH}:(ow-iw)/2:(oh-ih)/2:color=${BG},format=yuv420p" \
  -c:v libx264 -preset slow -crf 20 -r 30 -movflags +faststart -an \
  "$OUT/${NAME}-silent.mp4"
