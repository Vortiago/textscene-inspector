#!/usr/bin/env bash
# ESLint over the uncommitted code changes that still exist. Usage: bash .sweep/eslint.sh
set -eu
cd "$(dirname "$0")/.."
git diff --name-only --diff-filter=d HEAD | grep -E '\.(ts|tsx|js|mjs)$' | xargs -r npx eslint
