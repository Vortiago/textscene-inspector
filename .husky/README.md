# Husky Git Hooks

This directory contains Git hooks managed by [Husky](https://typicode.github.io/husky/).

## Pre-commit Hook

The `pre-commit` hook runs automatically before every commit and executes:

```bash
pnpm validate
```

This runs all validation checks in order:
1. **Build** - Compiles all packages (core + apps) and verifies TypeScript compilation
2. **Type Check** - Explicit TypeScript type validation across all packages
3. **ESLint** - Code style and quality checks
4. **All Tests** - Runs all unit and integration tests (2500+ tests)

## What happens if checks fail?

If any check fails, the commit will be **blocked**. You must fix the errors before you can commit.

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
pnpm lint-staged      # Run lint-staged checks
pnpm type-check       # Run type checking
pnpm build            # Run build
```

### Performance issues

If the pre-commit hook is too slow:

- Consider reducing the scope of `vitest related` (edit `package.json` lint-staged config)
- Use `git commit --no-verify` sparingly for WIP commits, then run `pnpm validate` before pushing

## Claude Code Web Integration

This repository also has validation hooks for **Claude Code Web** (`.claude/hooks/`).

| Scenario | What Validates |
|----------|----------------|
| Local git commit | Husky (this hook) |
| Claude Code CLI | Husky (this hook) |
| Claude Code Web | `.claude/hooks/validate-commit.sh` |

Both systems run the same validation (`pnpm validate`), ensuring consistency across all environments.

See `.claude/hooks/README.md` for Claude Code Web hook documentation.

## More information

- [Husky documentation](https://typicode.github.io/husky/)
- [lint-staged documentation](https://github.com/okonet/lint-staged)
- See `CLAUDE.md` for full development workflow
- See `.claude/hooks/README.md` for Claude Code Web hooks
