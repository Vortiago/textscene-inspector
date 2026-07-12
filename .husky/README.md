# Husky Git Hooks

This directory contains Git hooks managed by [Husky](https://typicode.github.io/husky/).

## Hooks at a glance

| Hook | Runs | Scope | Typical time |
|------|------|-------|--------------|
| `pre-commit` | `lint-staged` | **Staged files only** — `eslint --fix` + `vitest related --run` (`.ts/.tsx/.js/.jsx`), `build:linter` + `tscn-lint` (`.tscn`) | seconds |
| `pre-push` | `pnpm validate` | **Whole repo** — build + type-check + lint + all tests + bundle-size | ~3 min |

This split keeps the commit loop fast while guaranteeing that **nothing reaches a
shared branch unvalidated**: the full gate runs on every push (and again in CI).

## Pre-commit Hook (fast, staged files only)

The `pre-commit` hook runs `pnpm exec lint-staged`, which validates **only the
files you staged** — see [`lint-staged.config.mjs`](../lint-staged.config.mjs):
- **`*.{ts,tsx,js,jsx}`** → `eslint --fix` (auto-fixes + re-stages) then `vitest related --run` (only tests reachable from the changed files)
- **`*.tscn`** → builds the linter, then lints the changed scene files

## Pre-push Hook (full gate)

The `pre-push` hook runs `pnpm validate` — the complete pipeline:
1. **Build** - Compiles all packages (core + apps) and verifies TypeScript compilation
2. **Type Check** - Explicit TypeScript type validation across all packages
3. **ESLint** - Code style and quality checks
4. **All Tests** - Runs all unit and integration tests
5. **Bundle Size** - Verifies the VS Code webview bundle stays under budget

## What happens if checks fail?

If a `pre-commit` check fails, the commit is **blocked**; if a `pre-push` check
fails, the push is **blocked**. Fix the errors before retrying.

## Skipping hooks (not recommended)

If you absolutely need to skip the pre-commit hooks:

```bash
git commit --no-verify
```

**⚠️ Warning**: Only skip hooks when you have a very good reason (e.g., WIP commit on a feature branch). Never skip hooks for commits to main/shared branches.

## Modifying hooks

To modify the pre-commit hook:

1. Edit `.husky/pre-commit`
2. Make your changes
3. Commit the updated hook file (hooks are version controlled)

## Troubleshooting

### Hook not running

If the hook doesn't run automatically:

```bash
# Reinstall husky
pnpm prepare
```

### Hook fails but you think it shouldn't

Run the checks manually to debug:

```bash
pnpm exec lint-staged   # Run the pre-commit checks (staged files)
pnpm validate           # Run the full pre-push gate
```

### Performance issues

The pre-commit hook is already scoped to staged files. If it is still too slow:

- Reduce the scope of `vitest related` (edit `lint-staged.config.mjs`)
- Use `git commit --no-verify` sparingly for WIP commits — the `pre-push` hook still runs `pnpm validate` before the code leaves your machine

## Claude Code Web Integration

This repository also has validation hooks for **Claude Code Web** (`.claude/hooks/`).

| Scenario | What Validates |
|----------|----------------|
| Local git commit | Husky `pre-commit` (`lint-staged`, staged files) |
| Local git push | Husky `pre-push` (`pnpm validate`, full) |
| Claude Code CLI | Husky hooks (as above) |
| Claude Code Web | `.claude/hooks/validate-commit.sh` (`pnpm validate`) |

Pre-push runs the full `pnpm validate` in one shot; CI (`.github/workflows/ci.yml`) runs the
same gates as discrete steps (lint, type-check, tests, builds, `check:bundle-size`,
`check:package`) so a failure is attributed to the right step in the Actions UI. Either path
blocks on the same checks, so nothing reaches a shared branch unvalidated.

See `.claude/hooks/README.md` for Claude Code Web hook documentation.

## More information

- [Husky documentation](https://typicode.github.io/husky/)
- [lint-staged documentation](https://github.com/okonet/lint-staged)
- See `CLAUDE.md` for full development workflow
- See `.claude/hooks/README.md` for Claude Code Web hooks
