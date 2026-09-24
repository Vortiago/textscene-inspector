# Git hooks

This directory holds the git hooks of the project. Git runs them from here because
`core.hooksPath` points at `githooks`. The commit loop checks only the staged files. The full
gate runs on every push and again in CI, so nothing reaches a shared branch unvalidated.

## Hooks at a glance

| Hook | Runs | Scope |
|------|------|-------|
| `pre-commit` | `lint-staged` | **Staged files only**: `eslint --fix`, `vitest related --run` and the owning package's `type-check` (`.ts/.tsx/.js/.jsx/.mjs`), `build:linter` and `tscn-lint` (`.tscn/.tres`) |
| `pre-push` | `pnpm validate` | **Whole repo**: the full gate, below |

## Install

`pnpm install` runs the `prepare` script, `node githooks/install.mjs`. The script sets
`core.hooksPath` to `githooks` for the current worktree only:

- In a clone with one worktree, it writes the setting to `.git/config`.
- In a repository with more worktrees, it writes the setting to the worktree's own
  `config.worktree`. A worktree on an older commit keeps the hooks path that the shared
  config gives it, so no worktree points at a directory that its commit does not have.

Git reads `config.worktree` only when `extensions.worktreeConfig` is on. If the repository
has more worktrees and the extension is off, the script installs nothing and prints the
commands that turn the extension on. `pnpm install` still succeeds.

Do not turn the extension on while `core.bare` is in the shared config. Git then reads
`core.bare` in every worktree, and a bare repository makes every linked worktree bare. The
printed commands move `core.bare` to the main worktree's `config.worktree` first, then turn the
extension on. Run them in the printed order.

## Pre-commit hook (staged files only)

The `pre-commit` hook runs `pnpm exec lint-staged`. It checks only the files you
staged, as [`lint-staged.config.mjs`](../lint-staged.config.mjs) sets:
- **`*.{ts,tsx,js,jsx,mjs}`** → `eslint --fix` (fixes and re-stages), then `vitest related --run` (only the tests the changed files reach), then `type-check` for each package that owns a changed `.ts` or `.tsx` file
- **`*.{tscn,tres}`** → builds the linter, then lints the changed files, except the negative fixtures in `scenes/fixtures/negative-fixtures.json`

## Pre-push hook (full gate)

The `pre-push` hook runs `pnpm validate`. The `validate` script in the root
`package.json` is the list of steps: build, type-check (sources and tests), ESLint,
the unit suite, `lint:scenes`, the documentation checks, the font bake check,
`check:bundle-size` and `check:package`.

## What happens if checks fail?

If a `pre-commit` check fails, git blocks the commit. If a `pre-push` check fails,
git blocks the push. Fix the errors and try again.

## Skipping hooks (not recommended)

`HUSKY=0` skips both hooks, and `HUSKY=0 pnpm install` installs no hooks. Existing tools
set this variable to skip hooks, so the hooks read it.

To skip only the pre-commit hook:

```bash
git commit --no-verify
```

**⚠️ Warning**: Skip hooks only for a work-in-progress commit on a feature branch. Never skip hooks for a commit to main or a shared branch. The `pre-push` hook still runs `pnpm validate` before the code leaves your machine. Claude Code cannot skip the pre-commit hook with a flag: `.claude/hooks/check-no-verify.mjs` blocks `--no-verify` and `-n`.

## Modifying hooks

The hook files are under version control:

1. Edit `githooks/pre-commit` or `githooks/pre-push`.
2. Keep the file executable (`git ls-files -s githooks` shows mode `100755`).
3. Commit the changed hook file.

## Troubleshooting

### Hook not running

1. Check where git looks for hooks:

   ```bash
   git config --show-origin core.hooksPath
   ```

2. If the value is not `githooks`, run the install script again:

   ```bash
   pnpm prepare
   ```

3. If the script prints commands, run them in the printed order.

### Hook fails and you do not know why

Run the checks yourself:

```bash
pnpm exec lint-staged   # Run the pre-commit checks (staged files)
pnpm validate           # Run the full pre-push gate
```

### Performance issues

To make the pre-commit hook faster, reduce the scope of `vitest related` in
`lint-staged.config.mjs`.

## Claude Code integration

Claude Code has its own `PreToolUse` hooks in `.claude/hooks/`.

| Scenario | What validates |
|----------|----------------|
| Local git commit | `githooks/pre-commit` (`lint-staged`, staged files) |
| Local git push | `githooks/pre-push` (`pnpm validate`, full) |
| Claude Code `git commit` | The git hooks (as above). `.claude/hooks/check-no-verify.mjs` blocks `--no-verify` and `-n`. |
| Claude Code GitHub API commit | `.claude/hooks/validate-commit.mjs` (the `lint-staged` tasks, committed files) |

CI (`.github/workflows/ci.yml`) runs the same gates as `pnpm validate`, but as separate steps
(lint, type-check, tests, builds, `check:bundle-size`, `check:package`), so the Actions UI names
the step that failed. Both paths block on the same checks.

## More information

- [git hooks documentation](https://git-scm.com/docs/githooks)
- [lint-staged documentation](https://github.com/okonet/lint-staged)
- See `CLAUDE.md` for the full development workflow
- See `.claude/hooks/README.md` for the Claude Code hooks
