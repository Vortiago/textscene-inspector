#!/usr/bin/env bash
# The per-wave gate over the uncommitted changes. Usage: bash .sweep/gate.sh <log dir>
# Writes one "<step> <exit code>" line per step to <log dir>/gate.exit.
set -u
cd "$(dirname "$0")/.."
out=$1
mkdir -p "$out"
: > "$out/gate.exit"
step() {
  local name=$1
  shift
  "$@" > "$out/$name.log" 2>&1
  echo "$name $?" >> "$out/gate.exit"
}

git diff --name-only HEAD > "$out/changed.txt"
grep -E '\.(ts|tsx|js|mjs)$' "$out/changed.txt" > "$out/changed-code.txt" || true

step check xargs -a "$out/changed.txt" node .sweep/check.mjs
step keepList node .sweep/keepList.mjs
step commentOnly node .sweep/commentOnly.mjs
if [ -s "$out/changed-code.txt" ]; then
  step eslint xargs -a "$out/changed-code.txt" npx eslint
fi
step typeCheckAll pnpm type-check:all
step typeCheckTests pnpm type-check:tests
step unit pnpm test:unit
if grep -qE 'comparison|docs/comparison' "$out/changed.txt"; then
  step docsIndex pnpm docs:index --check
  step lintSections pnpm docs:lint-sections --check
fi
if grep -qE '\.tscn$' "$out/changed.txt"; then
  step lintScenes pnpm lint:scenes
fi
