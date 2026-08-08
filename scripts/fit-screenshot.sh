#!/usr/bin/env bash
# Fit any screenshot to the Chrome Web Store's 1280x800 requirement.
#
#   ./fit-screenshot.sh shot.png              -> shot-1280x800.png (fit + pad)
#   ./fit-screenshot.sh shot.png crop          -> center-crop instead of padding
#   ./fit-screenshot.sh *.png                  -> batch (fit + pad)
#
# Needs ImageMagick:  sudo apt install imagemagick
set -euo pipefail

PAD_COLOR="#f6f5fb"   # Softspot's light background, so padding looks deliberate
MODE="fit"

# Pick up a trailing "crop" argument.
args=("$@")
if [ "${args[${#args[@]}-1]:-}" = "crop" ]; then
  MODE="crop"
  unset 'args[${#args[@]}-1]'
fi

if [ ${#args[@]} -eq 0 ]; then
  echo "usage: $0 <image.png> [more.png ...] [crop]" >&2
  exit 1
fi

# ImageMagick 7 uses "magick", 6 uses "convert".
if command -v magick >/dev/null 2>&1; then
  IM="magick"
elif command -v convert >/dev/null 2>&1; then
  IM="convert"
else
  echo "ImageMagick not found. Install it with:  sudo apt install imagemagick" >&2
  exit 1
fi

for src in "${args[@]}"; do
  [ -f "$src" ] || { echo "skip (not a file): $src" >&2; continue; }
  out="${src%.*}-1280x800.png"

  if [ "$MODE" = "crop" ]; then
    # Fill the frame, then cut the overflow from the edges. No bars, but
    # you lose a little of the image.
    "$IM" "$src" -resize 1280x800^ -gravity center -extent 1280x800 "$out"
  else
    # Scale the whole image to fit, then pad to exactly 1280x800.
    # Nothing is cut off; you may get thin bars on two sides.
    "$IM" "$src" -resize 1280x800 -background "$PAD_COLOR" \
      -gravity center -extent 1280x800 "$out"
  fi

  echo "$out"
done
