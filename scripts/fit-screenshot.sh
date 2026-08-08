#!/usr/bin/env bash
# Fit screenshots to the Chrome Web Store's required 1280x800.
#
#   ./fit-screenshot.sh ~/Desktop/screenshots           -> whole folder (scales)
#   ./fit-screenshot.sh shot.png                        -> single file
#   ./fit-screenshot.sh ~/Desktop/screenshots crop      -> fill frame, trim edges
#   ./fit-screenshot.sh ~/Desktop/screenshots native    -> NO scaling, cut a
#                                                          1280x800 window out
#                                                          of the original
#
# Use "native" when text looks soft: it never resizes, so pixels stay exactly
# as sharp as they were on screen. You see less of the picture in exchange.
#
# Results are written to a "ready" subfolder next to the originals.
# Originals are never modified.
#
# Needs ImageMagick:  sudo apt install imagemagick
set -euo pipefail

PAD_COLOR="#f6f5fb"   # Softspot's light background, so padding looks deliberate
MODE="fit"

args=()
for a in "$@"; do
  case "$a" in
    crop|native) MODE="$a" ;;
    *) args+=("$a") ;;
  esac
done

if [ ${#args[@]} -eq 0 ]; then
  echo "usage: $0 <folder-or-image> [crop]" >&2
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

# Expand any folders into the image files they contain.
files=()
for a in "${args[@]}"; do
  if [ -d "$a" ]; then
    while IFS= read -r -d '' f; do files+=("$f"); done < <(
      find "$a" -maxdepth 1 -type f \
        \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' \) -print0 | sort -z
    )
  elif [ -f "$a" ]; then
    files+=("$a")
  else
    echo "skip (not found): $a" >&2
  fi
done

if [ ${#files[@]} -eq 0 ]; then
  echo "No images found." >&2
  exit 1
fi

outdir="$(dirname "${files[0]}")/ready"
mkdir -p "$outdir"

for src in "${files[@]}"; do
  base="$(basename "${src%.*}")"
  out="$outdir/${base}.png"

  if [ "$MODE" = "native" ]; then
    # No resizing at all: cut a 1280x800 window from the top-centre of the
    # original (where browser content lives). Sharpest possible result.
    # If the source is smaller than the frame, it gets padded instead.
    "$IM" "$src" -gravity north -background "$PAD_COLOR" -extent 1280x800 "$out"
  elif [ "$MODE" = "crop" ]; then
    # Fill the frame, then trim the overflow. No bars, loses the edges.
    "$IM" "$src" -resize 1280x800^ -gravity center -extent 1280x800 "$out"
  else
    # Scale the whole image to fit, then pad out to exactly 1280x800.
    "$IM" "$src" -resize 1280x800 -background "$PAD_COLOR" \
      -gravity center -extent 1280x800 "$out"
  fi

  echo "  $(basename "$src")  ->  ready/$(basename "$out")"
done

echo
echo "Done. ${#files[@]} image(s) written to: $outdir"
