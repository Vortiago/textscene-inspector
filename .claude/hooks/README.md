# Claude Code commit hooks

These `PreToolUse` hooks make every commit that Claude Code makes pass the checks of the git pre-commit hook.
Each hook is an ES module that `node` runs. Claude Code sends the tool input to the hook as JSON on
stdin.

## Exit codes

- Exit code 2 blocks the tool call. Claude Code shows the hook's stderr to Claude.
- Exit code 0 lets the tool call continue.
- Any other exit code, or a timeout, is a hook error. The tool call continues.

A hook that cannot read its input exits 0. A hook that crashes exits 1. Neither blocks a commit.

## Files

### `check-no-verify.mjs`

Blocks a `git commit` that skips the pre-commit hook. It runs for every Bash command.

1. Reads the Bash command from `tool_input.command`.
2. Removes the quoted text, so a commit message that holds `-n` is not a flag.
3. Splits the command at `&&`, `||`, `;`, `|` and new lines.
4. Finds each part that holds `git` and then `commit`.
5. If an option after `commit` is `--no-verify`, or a short-option cluster that holds `n` (`-n`,
   `-anm`), exits with code 2.
6. Exits with code 0 for every other command.

### `validate-commit.mjs`

Runs the pre-commit checks for `mcp__github_file_ops__commit_files`. That tool commits
through the GitHub API, so no git hook runs for it.

1. Reads the committed paths from `tool_input.files`.
2. Loads `lint-staged.config.mjs`, the configuration of the pre-commit hook.
3. Gets the commands of each task whose glob matches a committed path.
4. Runs the commands in order in `$CLAUDE_PROJECT_DIR`. Their output goes to stderr.
5. If a command fails, exits with code 2 and names the command.
6. Exits with code 0 when all commands pass, or when no path matches a glob.

A Bash `git commit` does not need this hook. The git pre-commit hook runs the same checks, and
`pnpm install` points git at `githooks/` in every checkout.

## Configuration

`.claude/settings.json` configures the hooks:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/check-no-verify.mjs"
          }
        ]
      },
      {
        "matcher": "mcp__github_file_ops__commit_files",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/validate-commit.mjs",
            "timeout": 300
          }
        ]
      }
    ]
  }
}
```

A `matcher` is compared with the tool name only, so the Bash hook runs for every Bash command.
`check-no-verify.mjs` finds the `git commit` in the command itself.

## Test the hooks

Send a sample input on stdin and read the exit code. Run these commands from the project root.

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"git commit --no-verify -m wip"}}' \
  | node .claude/hooks/check-no-verify.mjs; echo $?
```

The hook prints the refused flag and the reason, and the exit code is 2. The same command without
`--no-verify` gives exit code 0.

```bash
echo '{"tool_name":"mcp__github_file_ops__commit_files","tool_input":{"files":["README.md"]}}' \
  | CLAUDE_PROJECT_DIR=$PWD node .claude/hooks/validate-commit.mjs; echo $?
```

`README.md` matches no lint-staged glob, so the exit code is 0. A path to a `.mjs` file with an
ESLint error gives exit code 2.

## Comparison with the git hooks

| Feature | Git hooks (`githooks/`) | Claude Code (`.claude/hooks/`) |
|---------|-------------------------|--------------------------------|
| **Runs for** | A local `git commit` or `git push` | A Claude Code tool call |
| **Commit checks** | `lint-staged` on the staged files | The same `lint-staged` tasks on the files of a GitHub API commit |
| **Push checks** | `pnpm validate` | None. The git pre-push hook runs them. |
| **--no-verify** | Allowed | Blocked for Claude Code |

## More information

- `githooks/README.md` documents the git hooks.
- `AGENTS.md` documents the gates.
- The Claude Code hooks reference: https://code.claude.com/docs/en/hooks
