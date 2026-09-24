#!/usr/bin/env node
/**
 * The dev-edition site build: the previewer plus the games corpus (`scenes/games/**`,
 * gitignored). The corpus is deploy-only, so a local `pnpm vendor:games` keeps it out of the
 * local selector, and this is the one entry point that vendors it and sets
 * `VITE_INCLUDE_GAMES=1`. Point the Cloudflare Pages build command at `pnpm build:deploy`.
 * `pnpm build:pages` builds the public edition for GitHub Pages.
 */
import { spawnSync } from 'node:child_process';

const steps = [
  ['node', ['scripts/vendor-godot-games.mjs']],
  ['node', ['scripts/generate-fixtures.js']],
  ['pnpm', ['--filter', '@textscene/web-previewer', 'build']],
];

// Set here, not as a shell prefix on the npm script: `cmd.exe` cannot parse `FOO=1 cmd`.
// `apps/textscene-web/scripts/copy-fixtures.js` (to `public/fixtures/games/`) and
// `apps/textscene-web/src/fixturesAll.ts` (the `.games.` manifest) read it and must agree, or
// the selector lists unmirrored scenes. `pnpm dev` and a plain `pnpm build` leave it unset.
const env = { ...process.env, VITE_INCLUDE_GAMES: '1' };

for (const [command, args] of steps) {
  const result = spawnSync(command, args, { stdio: 'inherit', env, shell: process.platform === 'win32' });
  if (result.status !== 0) {
    console.error(`[build:deploy] "${command} ${args.join(' ')}" failed with ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

console.log('[build:deploy] built with the games corpus included');
