# Git hooks

Git runs the hooks in this directory before a commit and before a push. `pnpm install` points
`core.hooksPath` at it for the current worktree. If the install prints commands, run them in the
printed order.

| Hook | Runs | Checks |
| --- | --- | --- |
| `pre-commit` | `pnpm exec lint-staged` | The staged files, as [`lint-staged.config.mjs`](../lint-staged.config.mjs) sets |
| `commit-msg` | `.claude/skills/conventional-commits/commit-msg.sh` | The commit header: a [Conventional Commit](https://www.conventionalcommits.org/) |
| `pre-push` | `pnpm validate` | The whole repository: the `validate` script in the root `package.json` |

CI runs the same checks as `pnpm validate`.

## Skip the hooks

`HUSKY=0` skips every hook, and `HUSKY=0 pnpm install` installs none. The name stays because
existing tools already set it. `git commit --no-verify` skips only the pre-commit hook.

Skip a hook only for a work-in-progress commit on your own branch. The pre-push hook still runs
before the code leaves your machine. Claude Code cannot use `--no-verify`:
`.claude/hooks/check-no-verify.mjs` blocks it.

## Change a hook

1. Edit `githooks/pre-commit` or `githooks/pre-push`.
2. Keep the file executable: `git ls-files -s githooks` shows mode `100755`.

## When a hook does not run

1. Run `git config --show-origin core.hooksPath`.
2. If the value is not `githooks`, run `pnpm prepare`.

To run the checks without a commit or a push, run `pnpm exec lint-staged` or `pnpm validate`.
