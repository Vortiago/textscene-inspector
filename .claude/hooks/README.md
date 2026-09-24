# Claude Code validation hooks

These `PreToolUse` hooks make Claude Code Web validate a commit before it creates one, as Husky does for a local commit.

## Files

### `check-no-verify.js`

Blocks `git commit --no-verify`, so validation always runs.

1. Reads the tool input as JSON from stdin.
2. Extracts the Bash command with `jq`.
3. If the command matches `^git commit.*--no-verify`, exits with code 2, which blocks it.
4. Exits with code 0 for every other command.

A hook receives its input as JSON on stdin, not as arguments. A separate script reads stdin, which inline Bash in `settings.json` cannot do.

### `validate-commit.js`

Runs `pnpm validate` before a commit in Claude Code Web.

1. Runs only when `$CLAUDE_CODE_REMOTE` is `true`.
2. Reads the command from the tool input.
3. Skips a command that holds `--no-verify`. `check-no-verify.js` blocks that one.
4. Runs `pnpm validate` in `$CLAUDE_PROJECT_DIR`.
5. If validation fails, exits with code 2, which blocks the commit.

`pnpm validate` is the full gate in the root `package.json`: build, type checks, ESLint, all tests and the other checks listed there.

In the Claude Code CLI, `$CLAUDE_CODE_REMOTE` is not `true`, so the hook exits at once and Husky validates instead.

## Configuration

`.claude/settings.json` configures the hooks:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash(*git commit*)",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/check-no-verify.js"
          },
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/validate-commit.js",
            "timeout": 120
          }
        ]
      },
      {
        "matcher": "mcp__github_file_ops__commit_files",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/validate-commit.js",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

The hooks run in this order:

1. `check-no-verify.js` blocks `--no-verify`. It is fast.
2. `validate-commit.js` runs `pnpm validate`. It is slow.

## Flow

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
│ Run validate-commit.js              │
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

## Test the hooks

### In Claude Code Web

1. Change a file.
2. Stage the change: `git add .`
3. Commit: `git commit -m "test"`
4. Look for the message "🔍 Running validation before commit (Claude Code Web)...".
5. If validation passes, the commit succeeds. If it fails, the hook blocks the commit.

### The `--no-verify` block

```bash
git commit --no-verify -m "test"
```

The hook prints:
```
❌ --no-verify is not allowed. Validation is required.
```

## Troubleshooting

### The hook does not run

1. Check that `.claude/settings.json` holds the configuration above.
2. Check that `jq` is installed. `check-no-verify.js` needs it to parse JSON.

### Validation always fails

Run the gate by hand to see the ESLint, TypeScript and test errors:
```bash
pnpm validate
```

### The hook runs but does not block

Check the exit code in the script. `exit 0` allows the commit. `exit 2` blocks it.

## Environment variables

- `$CLAUDE_CODE_REMOTE`: `true` in Claude Code Web.
- `$CLAUDE_PROJECT_DIR`: the project root.

## Comparison with Husky

| Feature | Husky (`.husky/`) | Claude Code (`.claude/hooks/`) |
|---------|---------------------------|------------------------------|
| **Runs in** | Local git commits and pushes | Claude Code Web commits |
| **Trigger** | Git `pre-commit` and `pre-push` hooks | PreToolUse hook |
| **Validation** | `lint-staged` on commit, `pnpm validate` on push | `pnpm validate` on commit |
| **--no-verify** | Allowed (user choice) | Blocked (enforced) |
| **Environment** | CLI | Web UI |

## More information

- `.husky/README.md` documents the local Husky hooks.
- `AGENTS.md` documents the gates.
- Claude Code hooks documentation: https://docs.claude.com/
