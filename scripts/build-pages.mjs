#!/usr/bin/env node
/**
 * The public-edition build for GitHub Pages: the previewer with no built-in scenes, no
 * parity gallery and no source maps, served from a relative base, then the leak check on
 * its dist/. `pnpm build:deploy` builds the dev edition for Cloudflare Pages.
 * `apps/textscene-web/scripts/siteEdition.mjs` describes both.
 */
import { PUBLIC_SITE_EDITION } from '../apps/textscene-web/scripts/siteEdition.mjs';
import { runSteps } from './runSteps.mjs';

runSteps(
  'build:pages',
  [
    ['pnpm', ['--filter', '@textscene/web-previewer', 'build']],
    ['node', ['scripts/check-public-site.mjs']],
  ],
  { ...process.env, VITE_SITE_EDITION: PUBLIC_SITE_EDITION }
);

console.log('[build:pages] built and checked the public edition');
