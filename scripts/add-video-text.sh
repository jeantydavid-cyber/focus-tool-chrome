#!/usr/bin/env bash
# Burns the Softspot overlay text into a rendered clip.
# Usage: ./add-video-text.sh input.mp4
# Edit the timestamps below (seconds, decimals allowed) to match your clip,
# then run it. Output is written next to the input as <name>-final.mp4.
set -euo pipefail

IN="${1:?usage: $0 input.mp4}"
OUT="${IN%.*}-final.mp4"

# ---- EDIT THESE: when each line appears and disappears (seconds) ----
L1_FROM=0    L1_TO=3      # my brain can't ignore this      (restless scrolling)
L2_FROM=3    L2_TO=6      # so I made looking cost effort   (the blur lands)
L3_FROM=6    L3_TO=9      # still there. just quiet.        (scrolling the blur)
L4_FROM=9    L4_TO=13     # want to look? hold 1.5s...      (the peek hold)
L5_FROM=13   L5_TO=99     # Softspot, on the Chrome store   (runs to the end)
# ---------------------------------------------------------------------

FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf
DIR="$(mktemp -d)"
trap 'rm -rf "$DIR"' EXIT
printf '%s' "my brain can't ignore this"                 > "$DIR/1.txt"
printf '%s' "so I made looking cost effort"              > "$DIR/2.txt"
printf '%s' "still there. just quiet."                   > "$DIR/3.txt"
printf '%s\n%s' "want to look? hold 1.5s" "now it's a decision" > "$DIR/4.txt"
printf '%s' "Softspot, on the Chrome store"              > "$DIR/5.txt"

style="fontfile=$FONT:fontcolor=white:fontsize=54:box=1:boxcolor=black@0.45:boxborderw=18:x=(w-text_w)/2:y=h*0.16"

ffmpeg -y -i "$IN" -vf "\
drawtext=textfile=$DIR/1.txt:$style:enable='between(t,$L1_FROM,$L1_TO)',\
drawtext=textfile=$DIR/2.txt:$style:enable='between(t,$L2_FROM,$L2_TO)',\
drawtext=textfile=$DIR/3.txt:$style:enable='between(t,$L3_FROM,$L3_TO)',\
drawtext=textfile=$DIR/4.txt:$style:enable='between(t,$L4_FROM,$L4_TO)',\
drawtext=textfile=$DIR/5.txt:$style:enable='between(t,$L5_FROM,$L5_TO)'" \
  -c:v libx264 -preset medium -crf 18 -c:a copy "$OUT"

echo "Done: $OUT"
