#!/usr/bin/env node
import { PUBLIC_SITE_EDITION } from '../apps/textscene-web/scripts/siteEdition.mjs';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { runSteps } from './runSteps.mjs';
import { WEB_DIST } from './check-bundle-size/webFirstPaint.mjs';
import { CHUNK_GRAPH_FILE } from '../apps/textscene-web/scripts/chunkGraph.mjs';

const env = { ...process.env, VITE_SITE_EDITION: PUBLIC_SITE_EDITION };
runSteps(
  'build:pages',
  [
    ['pnpm', ['--filter', '@textscene/web-previewer', 'build']],
    ['node', ['scripts/check-web-bundle-size.mjs']],
  ],
  env
);
// Only the size gate reads the chunk graph, so the site ships without it.
rmSync(join(WEB_DIST, CHUNK_GRAPH_FILE));
runSteps('build:pages', [['node', ['scripts/check-public-site.mjs']]], env);

console.log('[build:pages] built and checked the public edition');
