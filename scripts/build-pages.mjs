#!/usr/bin/env node
/**
 * The public-edition build for GitHub Pages: the previewer with no built-in scenes, no
 * parity gallery and no source maps, served from a relative base. `pnpm build:deploy`
 * builds the dev edition for Cloudflare Pages. `apps/textscene-web/scripts/siteEdition.mjs`
 * describes both.
 */
import { spawnSync } from 'node:child_process';
import { PUBLIC_SITE_EDITION } from '../apps/textscene-web/scripts/siteEdition.mjs';

// Set here, not as a shell prefix on the npm script: `cmd.exe` cannot parse `FOO=1 cmd`.
const env = { ...process.env, VITE_SITE_EDITION: PUBLIC_SITE_EDITION };

const result = spawnSync('pnpm', ['--filter', '@textscene/web-previewer', 'build'], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
});
if (result.status !== 0) {
  console.error(`[build:pages] the web previewer build failed with ${result.status}`);
  process.exit(result.status ?? 1);
}

console.log('[build:pages] built the public edition');
