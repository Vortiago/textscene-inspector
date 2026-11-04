#!/usr/bin/env bash
# Downloads a VS Code fork for Linux x64 into $2 and prints its Electron executable on stdout.
# Usage: fetch-fork.sh <vscodium|cursor|windsurf> <directory>
# Only VSCodium (MIT) has a stable public release page. Cursor uses its download API and
# Windsurf its apt repository, unpacked without root; a vendor change fails the fork's CI job only.
set -euo pipefail

fork="$1"
dir="$2"
mkdir -p "$dir"
cd "$dir"

# Prints the executable called $2 under $1, or the layout on stderr when there is none.
# An AppImage nests its binary under usr/share/<name>/, four levels down.
find_executable() {
  local found
  found=$(find "$1" -maxdepth 5 -type f -name "$2" -perm -u+x | head -n 1)
  if [ -z "$found" ]; then
    echo "no executable named $2 under $1; layout:" >&2
    find "$1" -maxdepth 3 | head -n 60 >&2
  fi
  echo "$found"
}

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
  find_executable "$PWD/squashfs-root" cursor
}

fetch_windsurf() {
  local repo='https://windsurf-stable.codeiumdata.com/wVxQEIWkwPUEAGf3/apt'
  local package
  # The index lists every package the repository holds; keep the last stanza named windsurf.
  package=$(curl -fsSL "$repo/dists/stable/main/binary-amd64/Packages" \
    | awk '/^Package: /{name=$2} /^Filename: /{if (name == "windsurf") file=$2} END{print file}')
  echo "windsurf package: $package" >&2
  curl -fsSL -o windsurf.deb "$repo/$package"
  dpkg-deb -x windsurf.deb windsurf
  find_executable "$PWD/windsurf" windsurf
}

case "$fork" in
  vscodium) fetch_vscodium ;;
  cursor) fetch_cursor ;;
  windsurf) fetch_windsurf ;;
  *) echo "expected vscodium, cursor or windsurf, got $fork" >&2; exit 2 ;;
esac
