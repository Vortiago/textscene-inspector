#!/usr/bin/env node
/**
 * The deployed-site build: the previewer plus the on-demand games corpus.
 *
 * The games corpus (`scenes/games/**`, gitignored) is DEPLOY-ONLY. A developer
 * who ran `pnpm vendor:games` to verify against a real game should not thereby
 * get ~140 game scenes in their local scene selector, but the deployed site
 * does want them — so this is the one entry point that vendors them and sets
 * `VITE_INCLUDE_GAMES=1`. `pnpm dev` and a plain `pnpm build` leave them out.
 *
 * Two consumers read that variable and must agree, or the selector would list
 * scenes whose files were never mirrored:
 *   - `apps/textscene-web/scripts/copy-fixtures.js` → `public/fixtures/games/`
 *   - `apps/textscene-web/src/fixturesAll.ts`       → the `.games.` manifest
 *
 * The variable is set HERE rather than as a shell prefix on the npm script,
 * because `cmd.exe` cannot parse `FOO=1 cmd` — the same reason
 * `scripts/showcase/verify-2d.mjs` sets `SHOWCASE_CHANNEL` in JS.
 *
 * Point the Cloudflare Pages build command at `pnpm build:deploy`.
 */
import { spawnSync } from 'node:child_process';

const steps = [
  ['node', ['scripts/vendor-godot-games.mjs']],
  ['node', ['scripts/generate-fixtures.js']],
  ['pnpm', ['--filter', '@textscene/web-previewer', 'build']],
];

const env = { ...process.env, VITE_INCLUDE_GAMES: '1' };

for (const [command, args] of steps) {
  const result = spawnSync(command, args, { stdio: 'inherit', env, shell: process.platform === 'win32' });
  if (result.status !== 0) {
    console.error(`[build:deploy] "${command} ${args.join(' ')}" failed with ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

console.log('[build:deploy] built with the games corpus included');
