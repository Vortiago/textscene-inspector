/**
 * Control-subtree RASTERISER gate (ADR-0003 amendment, ADR-0024's rule).
 *
 * `rasterizeControlSubtree` turns a live Control DOM subtree into a canvas that
 * WebGL can sample — the derived raster a `SubViewport` composited onto a 3D
 * surface via `ViewportTexture` needs. Nothing in vitest can see whether it
 * works: happy-dom has neither layout nor a rasteriser, so it cannot lay a
 * Control out and cannot draw an SVG image. Only a real browser can, which is
 * exactly the situation ADR-0024 created a second harness for.
 *
 * Three suites, all asserting PIXELS, each in `raster/`:
 *
 *  A. `sub-resource contract` (`raster/suiteSubResource.mjs`) — self-contained,
 *     served from a throwaway `node:http` server, needs no preview build. It
 *     pins the browser behaviour the module exists to work around: Chrome
 *     renders SVG-as-image with sub-resource loading disabled, so a `blob:`
 *     image inside a foreignObject draws NOTHING while the same bitmap as a
 *     `data:` URL draws in full. Also covers the Godot default clear colour,
 *     supersampling, and the null guards.
 *
 *  B. `real overlay` (`raster/suiteOverlay.mjs`) — the actual ControlOverlay for
 *     a fixture, loaded through the preview server exactly as `verify-2d.mjs`
 *     loads it, then rasterised. This is the one that can catch "the module is
 *     fine but the real subtree rasterises blank".
 *
 *  C. `Control-raster publisher` (`raster/suitePublisher.mjs` and, on the same
 *     page, `raster/suiteDemo.mjs`) — the whole chain: the off-screen host a
 *     Control-only `SubViewport` mounts, the raster it publishes, and the
 *     pixels that reach the 3D quad consuming it as a `ViewportTexture`
 *     (ADR-0030). Its two colour assertions are Godot 4.6.3's own numbers for
 *     the same scene, so this is where the colour pipeline — one tonemap
 *     application, on the surface, never on the raster — is pinned.
 *
 * Requires the preview server at SHOWCASE_URL for suites B and C (as
 * `pnpm verify:2d` does), and `pnpm --filter @textscene/core build` for the
 * injected module.
 *
 *   pnpm verify:raster
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchShowcaseBrowser } from './browser.mjs';
import { startFixtureServer } from './raster/fixtureServer.mjs';
import { runOverlaySuite } from './raster/suiteOverlay.mjs';
import { runPublisherSuite } from './raster/suitePublisher.mjs';
import { runSubResourceSuite } from './raster/suiteSubResource.mjs';

const BASE = process.env.SHOWCASE_URL || 'http://localhost:4173';
const OUT = process.env.VERIFY_OUT || 'scripts/showcase/output';
// Bundled Chromium unless told otherwise — same determinism contract as the
// other showcase harnesses.
process.env.SHOWCASE_CHANNEL = process.env.SHOWCASE_CHANNEL || 'bundled';

const MODULE_PATH = 'packages/textscene-core/dist/r3f/controls/rasterizeControlSubtree.js';

mkdirSync(OUT, { recursive: true });

if (!existsSync(MODULE_PATH)) {
  console.error(
    `[verify-raster] ${MODULE_PATH} is missing — run \`pnpm --filter @textscene/core build\` first.`
  );
  process.exit(1);
}
const moduleSource = readFileSync(MODULE_PATH, 'utf8');
const failures = [];
const report = {};

/** Record a gate assertion; `detail` is echoed either way so numbers are always visible. */
function check(label, ok, detail) {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail === undefined ? '' : ` — ${detail}`}`);
  if (!ok) failures.push(`${label}${detail === undefined ? '' : ` (${detail})`}`);
}

const { server, fixtureUrl } = await startFixtureServer();

const browser = await launchShowcaseBrowser();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

// In order: the report's key order is its output order, and each suite's
// console block is read top to bottom against the previous one.
await runSubResourceSuite(ctx, { fixtureUrl, moduleSource, check, report });
await runOverlaySuite(ctx, { base: BASE, out: OUT, moduleSource, check, report });
await runPublisherSuite(ctx, { base: BASE, out: OUT, moduleSource, check, report });

await ctx.close();
await browser.close();
server.close();

writeFileSync(join(OUT, 'verify-raster.json'), JSON.stringify(report, null, 2));
console.log(`\nWrote verify-raster.json + raster-control-overlay.png to ${OUT}`);

if (failures.length > 0) {
  console.error(`\n[verify-raster] FAIL: ${failures.length} assertion(s)`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log('[verify-raster] PASS');
