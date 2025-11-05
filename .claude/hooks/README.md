# Claude Code Validation Hooks

This directory contains validation hooks for Claude Code (Web version).

## Purpose

These hooks ensure that Claude Code running in the web interface validates commits before they're created, similar to how Husky validates commits locally.

## Files

### `check-no-verify.sh`

Blocks `git commit --no-verify` attempts to ensure validation always runs.

**What it does:**
1. Reads JSON input from stdin (hook receives tool input as JSON)
2. Extracts the bash command using `jq`
3. Checks if command matches `git commit.*--no-verify`
4. Blocks the command with exit code 2 if matched
5. Exits cleanly (code 0) for all other commands

**Why a separate script?**
- Hooks receive JSON via **stdin**, not command line arguments
- Inline bash in `settings.json` can't easily read from stdin and parse JSON
- Separate script properly handles stdin reading with `cat`

### `validate-commit.sh`

The main validation script that runs before git commits in Claude Code Web.

**What it does:**
1. Detects if running in Claude Code Web (`$CLAUDE_CODE_REMOTE`)
2. Parses the git command being executed
3. Blocks `git commit --no-verify` attempts
4. Runs `pnpm validate` before allowing commits
5. Blocks the commit if validation fails

**Validation checks (`pnpm validate`) in order:**
1. Build - Compiles all packages and verifies TypeScript compilation
2. Type Check - Explicit TypeScript type validation across all packages
3. ESLint - Code style and quality checks
4. All Tests - Runs all unit and integration tests (2500+ tests)

## How It Works

### Trigger Conditions

The hook runs automatically when:
1. Claude Code Web executes `git commit` (any variant)
2. Claude Code Web uses GitHub MCP tool to commit
3. The command does NOT include `--no-verify`

### In Claude Code CLI

The hook does NOT run in CLI mode because:
- Husky handles validation locally
- No need for duplicate validation
- Respects `$CLAUDE_CODE_REMOTE` environment variable

## Hook Configuration

The hooks are configured in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/check-no-verify.sh"
          },
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/validate-commit.sh",
            "timeout": 120
          }
        ]
      },
      {
        "matcher": "mcp__github.*commit.*",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/validate-commit.sh",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

**Hook Execution Order:**
1. `check-no-verify.sh` - Blocks `--no-verify` (fast, exits early for non-git commands)
2. `validate-commit.sh` - Runs validation if git commit detected (slower, runs `pnpm validate`)

## Validation Flow

```
┌─────────────────────────────────────┐
│ Claude Code Web: git commit         │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ PreToolUse Hook Triggers            │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ Check for --no-verify               │
│ (blocked if present)                │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ Run validate-commit.sh              │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ Execute: pnpm validate              │
│ - eslint                            │
│ - type-check                        │
│ - tests                             │
└─────────────┬───────────────────────┘
              │
        ┌─────┴─────┐
        │           │
        ▼           ▼
    Success     Failure
        │           │
        ▼           ▼
   Commit      Commit
   Allowed     Blocked
```

## Testing the Hook

### Test in Claude Code Web

1. Make a change to any file
2. Stage the change: `git add .`
3. Try to commit: `git commit -m "test"`
4. Should see: "🔍 Running validation before commit (Claude Code Web)..."
5. If validation passes: commit succeeds
6. If validation fails: commit is blocked

### Test --no-verify blocking

```bash
git commit --no-verify -m "test"
```

Should see:
```
❌ --no-verify is not allowed. Validation is required.
```

### Test in CLI (hook should skip)

When running in CLI, the hook detects `$CLAUDE_CODE_REMOTE != "true"` and exits early, letting Husky handle validation instead.

## Troubleshooting

### Hook doesn't run

1. Check `.claude/settings.json` exists and has correct hook configuration
2. Verify `validate-commit.sh` is executable: `chmod +x .claude/hooks/validate-commit.sh`
3. Check that `jq` is installed (required for JSON parsing)

### Validation always fails

Run manually to debug:
```bash
pnpm validate
```

This will show specific errors from:
- ESLint issues
- TypeScript type errors
- Test failures

### Hook runs but doesn't block

Check the exit code in the script:
- `exit 0` = success (allows commit)
- `exit 2` = blocks tool use (blocks commit)

## Environment Variables

- `$CLAUDE_CODE_REMOTE` - Set to "true" when running in Claude Code Web
- `$CLAUDE_PROJECT_DIR` - Project root directory path

## Comparison with Husky

| Feature | Husky (.husky/pre-commit) | Claude Code (.claude/hooks/) |
|---------|---------------------------|------------------------------|
| **Runs in** | Local git commits | Claude Code Web commits |
| **Trigger** | Git pre-commit hook | PreToolUse hook |
| **Validation** | `pnpm validate` | `pnpm validate` |
| **--no-verify** | Allowed (user choice) | Blocked (enforced) |
| **Environment** | CLI | Web UI |

## Benefits

✅ **Consistency**: Same validation in web and CLI
✅ **Safety**: Can't bypass with `--no-verify` in Claude Code Web
✅ **Transparency**: Claude sees validation output in real-time
✅ **Team-wide**: All Claude Code users get validation automatically
✅ **Fail-fast**: Catches issues before commit, not in CI

## More Information

- See `.husky/README.md` for local Husky hooks documentation
- See `CLAUDE.md` for full development workflow
- Claude Code hooks documentation: https://docs.claude.com/
