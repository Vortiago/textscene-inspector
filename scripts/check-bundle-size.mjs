#!/usr/bin/env node
/**
 * Bundle-size guards for the VS Code extension:
 *
 * 1. The webview's initial-paint chunk (600 kB gzipped budget, see
 *    `main()` below — the repo's `check:bundle-size` script passes
 *    `--enforce`, so validate/pre-push/CI hard-fail when it is exceeded).
 * 2. The extension HOST bundles (`dist/extension.js` / `extension.web.js`),
 *    which must never bundle `react`/`three` (hard invariant — see
 *    `checkHostBundles()`).
 *
 * ## Webview budget
 *
 * Walks the static import closure starting from `dist/webview/webview.js`,
 * gzips the concatenation, and compares against the renegotiated absolute
 * budget (`BUDGET_GZ`). Dynamic `import()` (React.lazy) chunks are
 * deliberately excluded — they don't load on the canvas-paint critical
 * path, so they don't count against this budget.
 *
 * The webview build was flipped from `iife` to `esm` + splitting so
 * React.lazy could actually code-split. Before that flip
 * the entire bundle was the initial chunk (4.1 MB raw / 717 KB gzipped
 * unminified, or 1.4 MB raw / ~620 KB gzipped minified).
 *
 * ## Host bundle guard
 *
 * The extension HOST (`src/extension.ts`, bundled as `dist/extension.js`
 * for desktop VS Code and `dist/extension.web.js` for vscode.dev) must
 * import only React-free `@textscene/core` subpaths (`/parser`, `/linter`,
 * `/logger`, targeted resource utils) — never the root barrel, whose
 * React/CSS side effects defeat tree-shaking and balloon the host bundle
 * ~4x (see ARCHITECTURE.md, "Bundle Size Target"). The guard prefers the
 * esbuild METAFILE (`dist/*.meta.json`, written by esbuild.config.mjs):
 * asserting that no `node_modules/react|three|...` input was bundled is
 * exact — immune to ordinary string literals that merely contain the
 * English words "react"/"three". When the metafile is missing (older
 * build), it falls back to a word-boundaried token scan of the bundle
 * text. Fails unconditionally either way — this is a binary invariant,
 * not a soft budget, so it is NOT gated behind `--enforce`.
 *
 * Run modes:
 *   node scripts/check-bundle-size.mjs            # webview budget informational; host guard always hard-fails
 *   node scripts/check-bundle-size.mjs --enforce  # webview budget also exits 1 if over budget (hard-fail)
 *
 * The repo's `pnpm check:bundle-size` script (package.json) passes
 * `--enforce`, so validate / pre-push / CI all hard-fail on a webview
 * budget breach.
 */

import { gzipSync } from 'node:zlib';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = join(dirname(__filename), '..');
const WEBVIEW_DIR = join(REPO_ROOT, 'apps/textscene-vscode/dist/webview');
const ENTRY = 'webview.js';

const HOST_BUNDLE_PATHS = [
  join(REPO_ROOT, 'apps/textscene-vscode/dist/extension.js'),
  join(REPO_ROOT, 'apps/textscene-vscode/dist/extension.web.js'),
];
const HOST_FORBIDDEN_WORDS = ['react', 'three'];

/**
 * Scans host-bundle content for whole-word `react` / `three` tokens.
 * Word-boundaried (`\bWORD\b`) so it matches `require("react")`,
 * `"react-dom"`, `from"three"`, `three/examples/...` etc., but not
 * unrelated words that merely contain the substring, like "reactive",
 * "reaction", "overreacted", "threefold", or "threescore".
 *
 * FALLBACK path only (no metafile next to the bundle): a plain English
 * string literal like "expected three arguments" WOULD trip this — the
 * metafile check below is the primary, exact guard.
 *
 * Exported for unit testing; also used by `checkHostBundles()` below.
 */
export function findHostBundleViolations(content) {
  return HOST_FORBIDDEN_WORDS.filter((word) => new RegExp(`\\b${word}\\b`, 'i').test(content));
}

/**
 * Any react/three ecosystem module bundled into the host, per the esbuild
 * metafile's `inputs` map. Matches the package segment after a
 * `node_modules/` (covers pnpm's nested `node_modules/.pnpm/.../node_modules/react/`
 * layout too), so source files or string literals can never false-positive.
 *
 * Exported for unit testing; also used by `checkHostBundles()` below.
 */
export function findForbiddenHostInputs(metafile) {
  // `three` is anchored by the trailing slash, so it does NOT match `three-bvh-csg/`
  // or `three-mesh-bvh/`. The three-mesh-bvh gap predates the CSG work: drei has
  // depended on it all along.
  const forbidden =
    /node_modules\/(react|react-dom|scheduler|three|three-bvh-csg|three-mesh-bvh|@react-three)\//;
  return Object.keys(metafile.inputs ?? {}).filter((input) => forbidden.test(input));
}

/**
 * Asserts every path in `HOST_BUNDLE_PATHS` is free of `react`/`three`.
 * Returns `false` (never throws) so `main()` can report every finding
 * before deciding the process exit code.
 */
function checkHostBundles() {
  console.log('\n=== VS Code extension HOST bundles (must stay React/THREE-free) ===');
  let ok = true;
  for (const bundlePath of HOST_BUNDLE_PATHS) {
    const rel = relative(REPO_ROOT, bundlePath);
    if (!existsSync(bundlePath)) {
      console.warn(`[bundle-size] SKIP: ${rel} not found — build the extension first.`);
      continue;
    }

    // Primary: the esbuild metafile lists exactly which modules were bundled.
    const metaPath = bundlePath.replace(/\.js$/, '.meta.json');
    let violations;
    let how;
    if (existsSync(metaPath)) {
      violations = findForbiddenHostInputs(JSON.parse(readFileSync(metaPath, 'utf8')));
      how = 'metafile';
    } else {
      // Fallback: heuristic token scan of the bundle text (older builds
      // without dist/*.meta.json).
      violations = findHostBundleViolations(readFileSync(bundlePath, 'utf8'));
      how = 'token scan — rebuild for the exact metafile check';
    }

    if (violations.length > 0) {
      console.error(
        `[bundle-size] FAIL: ${rel} bundles forbidden react/three code (${how}): ${violations.join(', ')}`
      );
      console.error(
        '[bundle-size] the extension host must import only React-free @textscene/core ' +
          'subpaths (parser/linter/logger) — see ARCHITECTURE.md "Bundle Size Target".'
      );
      ok = false;
    } else {
      console.log(
        `[bundle-size] PASS: ${rel} is React/THREE-free via ${how} (${formatKb(statSync(bundlePath).size)}).`
      );
    }
  }
  return ok;
}

// Budget history (see ARCHITECTURE.md "Bundle Size Target"):
// - Original budget: main baseline + 200 KB gzipped (247,543 + 200,000 =
//   447,543 B), from the original acceptance criterion. That criterion
//   predates GLB support becoming a committed, shipped feature.
// - Renegotiated 2026-07-14 to an absolute 600 kB gzipped ceiling, after
//   the realistic lazy-loading was done (drei <Text>/troika; GLTFLoader +
//   SkeletonUtils) and the closure settled at
//   484,921 B gz, leaving ~115 KB of headroom. Growth is acceptable for now;
//   the future direction is exploring lighter rendering technologies,
//   not squeezing this stack further.
// MAIN_BASELINE_GZ (the pre-merge measurement of `main` from the original
// budget) is kept only for the informational delta-vs-main report line.
const MAIN_BASELINE_GZ = 247_543;
const BUDGET_GZ = 600_000; // renegotiated absolute ceiling, gzipped

// Dead-weight chunks that must never ship in the VSIX. These appear when
// someone imports from the `@react-three/drei` barrel instead of the
// per-module subpaths (`@react-three/drei/core/<Module>`): esbuild then
// bundles drei's unused video/face modules, whose dynamic import('hls.js')
// / import('@mediapipe/tasks-vision') emit ~656 KB of lazy chunks that no
// code path ever loads.
const DEAD_CHUNK_RE = /^(hls|vision_bundle)-/;

/**
 * Find static (non-dynamic) imports in a JS file. Dynamic `import()`
 * calls are stripped to a sentinel first so they don't show up as
 * static deps in the closure walk — those chunks load on demand.
 */
function findStaticImports(content) {
  const stripped = content.replace(/import\([^)]*\)/g, '__DYN__()');
  const out = new Set();
  // import ... from '...';  export ... from '...';  export * from '...';
  // (re-export forwards pull the target chunk onto the critical path just
  // like imports do, even though esbuild's current splitting output happens
  // to emit only the import form — the gate must not depend on that.)
  const re1 = /(?:import|export)[^'";]*?from[^'"]*["']\.\/(?:chunks\/)?([^'"]+)["']/g;
  let m;
  while ((m = re1.exec(stripped))) out.add(m[1]);
  // bare side-effect import: import '...';
  const re2 = /(?:^|[;\s])import\s*["']\.\/(?:chunks\/)?([^'"]+)["']/g;
  while ((m = re2.exec(stripped))) out.add(m[1]);
  return out;
}

/**
 * BFS the static-import closure starting at `entry`. Returns the set
 * of file names (relative to the webview dir) that load on the critical
 * canvas-paint path.
 */
function staticClosure(dir, entry) {
  const visited = new Set();
  const queue = [entry];
  while (queue.length > 0) {
    const f = queue.shift();
    if (visited.has(f)) continue;
    visited.add(f);
    const fp = join(dir, f);
    if (!existsSync(fp)) continue;
    const content = readFileSync(fp, 'utf8');
    for (const imp of findStaticImports(content)) {
      const target = f === entry ? `chunks/${imp}` : `chunks/${imp.split('/').pop()}`;
      queue.push(target);
    }
  }
  return visited;
}

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function main() {
  const enforce = process.argv.includes('--enforce');

  // The host-bundle guard is a binary invariant (never gated behind
  // --enforce) and independent of the webview build, so it runs first and
  // unconditionally regardless of whether the webview has been built.
  const hostOk = checkHostBundles();

  if (!existsSync(join(WEBVIEW_DIR, ENTRY))) {
    console.error(`\n[bundle-size] entry not found: ${join(WEBVIEW_DIR, ENTRY)}`);
    console.error('[bundle-size] run `pnpm --filter textscene-inspector build` first');
    process.exit(!hostOk || enforce ? 1 : 0);
  }

  const chunksDir = join(WEBVIEW_DIR, 'chunks');
  const deadChunks = existsSync(chunksDir)
    ? readdirSync(chunksDir).filter((f) => DEAD_CHUNK_RE.test(f))
    : [];
  if (deadChunks.length > 0) {
    console.error(
      `[bundle-size] FAIL: dead-weight chunks in dist/webview/chunks: ${deadChunks.join(', ')}`
    );
    console.error(
      '[bundle-size] import drei via @react-three/drei/core/<Module> subpaths, not the barrel.'
    );
    process.exit(1);
  }

  const closure = staticClosure(WEBVIEW_DIR, ENTRY);
  const buffers = [];
  let totalRaw = 0;
  for (const f of [...closure].sort()) {
    const fp = join(WEBVIEW_DIR, f);
    if (!existsSync(fp)) continue;
    const buf = readFileSync(fp);
    totalRaw += buf.length;
    buffers.push(buf);
  }
  const totalGz = gzipSync(Buffer.concat(buffers)).length;
  const overBaseline = totalGz - MAIN_BASELINE_GZ;

  console.log('\n=== VS Code webview initial-paint bundle ===');
  console.log(`Files (static-import closure): ${closure.size}`);
  for (const f of [...closure].sort()) {
    const fp = join(WEBVIEW_DIR, f);
    if (existsSync(fp)) {
      console.log(`  ${f}  ${formatKb(statSync(fp).size)}`);
    }
  }
  console.log(`Total raw:        ${formatKb(totalRaw)}  (${totalRaw} B)`);
  console.log(`Total gzipped:    ${formatKb(totalGz)}  (${totalGz} B)`);
  console.log(`Main baseline:    ${formatKb(MAIN_BASELINE_GZ)}  (${MAIN_BASELINE_GZ} B)`);
  console.log(`Delta vs main:    ${overBaseline >= 0 ? '+' : ''}${formatKb(overBaseline)}  (${overBaseline} B)`);
  console.log(`Budget absolute:  ${formatKb(BUDGET_GZ)}  (${BUDGET_GZ} B)`);

  const overBudget = totalGz - BUDGET_GZ;
  let webviewOverBudget = false;
  if (overBudget > 0) {
    webviewOverBudget = true;
    const msg = `[bundle-size] FAIL: initial chunk is ${formatKb(overBudget)} OVER the budget (gzipped ${totalGz} > ${BUDGET_GZ}).`;
    if (enforce) {
      console.error(msg);
    } else {
      console.warn(`[bundle-size] WARN: ${msg} (informational; pass --enforce to fail)`);
    }
  } else {
    console.log(`[bundle-size] PASS: ${formatKb(-overBudget)} headroom under budget.`);
  }

  // The host-bundle guard always hard-fails; the webview budget only
  // hard-fails in --enforce mode.
  if (!hostOk || (webviewOverBudget && enforce)) {
    process.exit(1);
  }
}

// Only run when executed directly (`node scripts/check-bundle-size.mjs`),
// not when imported by `check-bundle-size.test.mjs` for its pure functions.
// `pathToFileURL` (rather than a manual `file://` template) is required for
// this comparison to hold on Windows, where `process.argv[1]` is a
// `C:\...`-style path, not a POSIX one.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
