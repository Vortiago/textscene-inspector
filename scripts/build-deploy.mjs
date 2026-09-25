#!/usr/bin/env node
/**
 * The dev-edition site build: the previewer plus the games corpus (`scenes/games/**`,
 * gitignored). The corpus is deploy-only, so a local `pnpm vendor:games` keeps it out of the
 * local selector, and this is the one entry point that vendors it and sets
 * `VITE_INCLUDE_GAMES=1`. Point the Cloudflare Pages build command at `pnpm build:deploy`.
 * `pnpm build:pages` builds the public edition for GitHub Pages.
 */
import { DEV_SITE_EDITION } from '../apps/textscene-web/scripts/siteEdition.mjs';
import { runSteps } from './runSteps.mjs';

const steps = [
  ['node', ['scripts/vendor-godot-games.mjs']],
  ['node', ['scripts/generate-fixtures.js']],
  ['pnpm', ['--filter', '@textscene/web-previewer', 'build']],
];

// `apps/textscene-web/scripts/copy-fixtures.js` (to `public/fixtures/games/`) and
// `apps/textscene-web/src/fixturesAll.ts` (the `.games.` manifest) read it and must agree, or
// the selector lists unmirrored scenes. `pnpm dev` and a plain `pnpm build` leave it unset.
// The edition is set too: an inherited `VITE_SITE_EDITION=public` would empty the catalog.
const env = { ...process.env, VITE_INCLUDE_GAMES: '1', VITE_SITE_EDITION: DEV_SITE_EDITION };

runSteps('build:deploy', steps, env);

console.log('[build:deploy] built with the games corpus included');
