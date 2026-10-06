# Git hooks

Git runs the hooks in this directory before a commit and before a push. `pnpm install` points
`core.hooksPath` at it for the current worktree. If the install prints commands, run them in the
printed order.

| Hook | Runs | Checks |
| --- | --- | --- |
| `pre-commit` | `pnpm exec lint-staged` | eslint and Prettier on the staged files, and the scene lint, as [`lint-staged.config.mjs`](../lint-staged.config.mjs) sets |
| `commit-msg` | `.claude/skills/conventional-commits/commit-msg.sh` | The commit header: a [Conventional Commit](https://www.conventionalcommits.org/) |
| `pre-push` | `scripts/githooks/prePush.mjs` | The static checks that match the pushed files and the tests beside them, from `scripts/githooks/prePushPlan.mjs` |

The pre-push hook runs the tests beside each pushed file: `Name.test.ts` and `Name.*.test.ts`
beside `Name.ts`, and each pushed test file. CI runs the whole suite, the builds and the packaging
on each pull request and on `main`. To run every test that imports a file, run
`pnpm exec vitest related --run <files>`.

A pushed TypeScript file type-checks its package and every package that depends on it. A change
in `apps/textscene-web` checks only the web previewer. A change in `packages/textscene-core`
checks core and each app.

A change to the toolchain (`package.json`, the lockfile, a `tsconfig`, a vitest, eslint or
Prettier config, or a hook) runs the static checks over the whole repository: `format:check`,
`lint`, `type-check:all` and `type-check:tests`. It still runs the tests beside the pushed
files. A push that changes only files no check reads runs nothing. `FULL_VALIDATE=1 git push` runs the full `pnpm validate`.

eslint and Prettier check only the files that changed since their last run. eslint keeps its cache
in `.eslintcache`, and Prettier keeps its cache in `node_modules/.cache/prettier/`. Each tool
discards its cache when its configuration or version changes. Delete a cache to check every file
again.

## Skip the hooks

`HUSKY=0` skips every hook, and `HUSKY=0 pnpm install` installs none. The name stays because
existing tools already set it. `git commit --no-verify` skips the pre-commit and commit-msg hooks.

Skip a hook only for a work-in-progress commit on your own branch. CI still runs the full gate. Claude Code cannot use `--no-verify`:
`.claude/hooks/check-no-verify.mjs` blocks it.

## Change a hook

1. Edit `githooks/pre-commit` or `githooks/pre-push`.
2. Keep the file executable: `git ls-files -s githooks` shows mode `100755`.

## When a hook does not run

1. Run `git config --show-origin core.hooksPath`.
2. If the value is not `githooks`, run `pnpm prepare`.

To run the checks without a commit or a push, run `pnpm exec lint-staged` or `pnpm validate`.
