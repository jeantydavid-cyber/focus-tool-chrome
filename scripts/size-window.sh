#!/usr/bin/env bash
# Resize a window to exactly 1280x800 so screenshots need no scaling.
# Essential on large or ultrawide monitors, where shrinking a full-screen
# capture down to the store's 1280x800 destroys text quality.
#
#   ./size-window.sh          click the target window within 4 seconds
#   ./size-window.sh 6        give yourself 6 seconds instead
#
# Needs wmctrl:  sudo apt install wmctrl
set -euo pipefail

DELAY="${1:-4}"
W=1280
H=800

if ! command -v wmctrl >/dev/null 2>&1; then
  echo "wmctrl not found. Install it with:  sudo apt install wmctrl" >&2
  exit 1
fi

echo "Click the window you want to resize. Resizing in ${DELAY} seconds..."
for ((i = DELAY; i > 0; i--)); do
  printf '\r  %d ' "$i"
  sleep 1
done
printf '\r      \r'

# Unmaximize first, otherwise the resize is ignored.
wmctrl -r :ACTIVE: -b remove,maximized_vert,maximized_horz || true
sleep 0.3
wmctrl -r :ACTIVE: -e "0,80,80,${W},${H}"

echo "Done. That window is now ${W}x${H}."
echo "Set up your shot, then press Alt+PrtScn to capture just this window."
