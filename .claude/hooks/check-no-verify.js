#!/bin/bash
# .claude/hooks/check-no-verify.sh

# Read JSON input from stdin
INPUT=$(cat)

# Extract the bash command
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Block git commit with --no-verify
if [[ "$COMMAND" =~ ^git[[:space:]]+commit.*--no-verify ]]; then
  echo "❌ --no-verify is not allowed. Validation is required." >&2
  exit 2
fi

exit 0
