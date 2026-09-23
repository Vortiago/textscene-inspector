# Husky Git Hooks

This directory holds the Git hooks that [Husky](https://typicode.github.io/husky/) installs.
The commit loop checks only the staged files. The full gate runs on every push and again in CI,
so nothing reaches a shared branch unvalidated.

## Hooks at a glance

| Hook | Runs | Scope |
|------|------|-------|
| `pre-commit` | `lint-staged` | **Staged files only**: `eslint --fix`, `vitest related --run` and the owning package's `type-check` (`.ts/.tsx/.js/.jsx/.mjs`), `build:linter` and `tscn-lint` (`.tscn/.tres`) |
| `pre-push` | `pnpm validate` | **Whole repo**: the full gate, below |

## Pre-commit Hook (staged files only)

The `pre-commit` hook runs `pnpm exec lint-staged`. It checks only the files you
staged, as [`lint-staged.config.mjs`](../lint-staged.config.mjs) sets:
- **`*.{ts,tsx,js,jsx,mjs}`** → `eslint --fix` (fixes and re-stages), then `vitest related --run` (only the tests the changed files reach), then `type-check` for each package that owns a changed `.ts` or `.tsx` file
- **`*.{tscn,tres}`** → builds the linter, then lints the changed files, except the negative fixtures in `scenes/fixtures/negative-fixtures.json`

## Pre-push Hook (full gate)

The `pre-push` hook runs `pnpm validate`. The `validate` script in the root
`package.json` is the list of steps: build, type-check (sources and tests), ESLint,
the unit suite, `lint:scenes`, the documentation checks, the font bake check,
`check:bundle-size` and `check:package`.

## What happens if checks fail?

If a `pre-commit` check fails, Git blocks the commit. If a `pre-push` check fails,
Git blocks the push. Fix the errors and try again.

## Skipping hooks (not recommended)

To skip the pre-commit hook:

```bash
git commit --no-verify
```

**⚠️ Warning**: Skip hooks only for a work-in-progress commit on a feature branch. Never skip hooks for a commit to main or a shared branch. The `pre-push` hook still runs `pnpm validate` before the code leaves your machine.

## Modifying hooks

The hook files are under version control:

1. Edit `.husky/pre-commit` or `.husky/pre-push`.
2. Commit the changed hook file.

## Troubleshooting

### Hook not running

If a hook does not run, reinstall Husky:

```bash
# Reinstall husky
pnpm prepare
```

### Hook fails and you do not know why

Run the checks yourself:

```bash
pnpm exec lint-staged   # Run the pre-commit checks (staged files)
pnpm validate           # Run the full pre-push gate
```

### Performance issues

To make the pre-commit hook faster, reduce the scope of `vitest related` in
`lint-staged.config.mjs`.

## Claude Code Web Integration

**Claude Code Web** has its own validation hooks in `.claude/hooks/`.

| Scenario | What Validates |
|----------|----------------|
| Local git commit | Husky `pre-commit` (`lint-staged`, staged files) |
| Local git push | Husky `pre-push` (`pnpm validate`, full) |
| Claude Code CLI | Husky hooks (as above) |
| Claude Code Web | `.claude/hooks/validate-commit.js` (`pnpm validate`) |

CI (`.github/workflows/ci.yml`) runs the same gates as `pnpm validate`, but as separate steps
(lint, type-check, tests, builds, `check:bundle-size`, `check:package`), so the Actions UI names
the step that failed. Both paths block on the same checks.

## More information

- [Husky documentation](https://typicode.github.io/husky/)
- [lint-staged documentation](https://github.com/okonet/lint-staged)
- See `CLAUDE.md` for the full development workflow
- See `.claude/hooks/README.md` for the Claude Code Web hooks
