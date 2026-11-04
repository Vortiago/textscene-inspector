#!/usr/bin/env bash
# Downloads a VS Code fork for Linux x64 into $2 and prints its Electron executable on stdout.
# Usage: fetch-fork.sh <vscodium|cursor|windsurf> <directory>
# Only VSCodium (MIT) has a stable public release page. The Cursor and Windsurf download
# endpoints are the vendors' own update APIs; a vendor change fails the fork's CI job only.
set -euo pipefail

fork="$1"
dir="$2"
mkdir -p "$dir"
cd "$dir"

fetch_vscodium() {
  gh release download --repo VSCodium/vscodium --pattern 'VSCodium-linux-x64-*.tar.gz' --output vscodium.tar.gz
  tar -xzf vscodium.tar.gz
  echo "$PWD/codium"
}

fetch_cursor() {
  local url
  url=$(curl -fsSL -A 'Mozilla/5.0' 'https://www.cursor.com/api/download?platform=linux-x64&releaseTrack=stable' \
    | jq -r .downloadUrl)
  curl -fsSL -A 'Mozilla/5.0' -o cursor.AppImage "$url"
  chmod +x cursor.AppImage
  ./cursor.AppImage --appimage-extract > /dev/null
  find "$PWD/squashfs-root" -maxdepth 3 -type f -name cursor -perm -u+x | head -n 1
}

fetch_windsurf() {
  local url
  url=$(curl -fsSL 'https://windsurf-stable.codeiumdata.com/api/update/linux-x64/stable/latest' | jq -r .url)
  curl -fsSL -o windsurf.tar.gz "$url"
  tar -xzf windsurf.tar.gz
  find "$PWD" -maxdepth 3 -type f -name windsurf -perm -u+x | head -n 1
}

case "$fork" in
  vscodium) fetch_vscodium ;;
  cursor) fetch_cursor ;;
  windsurf) fetch_windsurf ;;
  *) echo "expected vscodium, cursor or windsurf, got $fork" >&2; exit 2 ;;
esac
