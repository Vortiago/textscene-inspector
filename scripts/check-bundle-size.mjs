#!/usr/bin/env node
/**
 * Bundle-size guard for the VS Code webview's initial paint chunk.
 *
 * Walks the static import closure starting from `dist/webview/webview.js`,
 * gzips the concatenation, and compares against the main baseline + the
 * agreed-upon budget. Dynamic `import()` (React.lazy) chunks are
 * deliberately excluded — they don't load on the canvas-paint critical
 * path, so they don't count against this budget.
 *
 * WI-R3F-18 (this commit) flipped the webview build from `iife` to
 * `esm` + splitting so React.lazy could actually code-split. Pre-this-WI
 * the entire bundle was the initial chunk (4.1 MB raw / 717 KB gzipped
 * unminified, or 1.4 MB raw / ~620 KB gzipped minified).
 *
 * Run modes:
 *   node scripts/check-bundle-size.mjs            # informational; never exits non-zero
 *   node scripts/check-bundle-size.mjs --enforce  # exits 1 if over budget (CI hard-fail)
 */

import { gzipSync } from 'node:zlib';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = join(dirname(__filename), '..');
const WEBVIEW_DIR = join(REPO_ROOT, 'apps/textscene-vscode/dist/webview');
const ENTRY = 'webview.js';

// Baseline + budget from PR #44's pre-merge measurement and the agreed
// +200 KB gzipped acceptance criterion. See ARCHITECTURE.md.
const MAIN_BASELINE_GZ = 247_543;
const BUDGET_OVER_BASELINE_GZ = 200_000;
const BUDGET_GZ = MAIN_BASELINE_GZ + BUDGET_OVER_BASELINE_GZ; // 447 KB gzipped

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
  // import ... from '...';
  const re1 = /import[^'";]*?from[^'"]*["']\.\/(?:chunks\/)?([^'"]+)["']/g;
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

  if (!existsSync(join(WEBVIEW_DIR, ENTRY))) {
    console.error(`[bundle-size] entry not found: ${join(WEBVIEW_DIR, ENTRY)}`);
    console.error('[bundle-size] run `pnpm --filter textscene-inspector build` first');
    process.exit(enforce ? 1 : 0);
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

  console.log('=== VS Code webview initial-paint bundle ===');
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
  console.log(`Budget over main: ${formatKb(BUDGET_OVER_BASELINE_GZ)}  (${BUDGET_OVER_BASELINE_GZ} B)`);
  console.log(`Budget absolute:  ${formatKb(BUDGET_GZ)}  (${BUDGET_GZ} B)`);

  const overBudget = totalGz - BUDGET_GZ;
  if (overBudget > 0) {
    const msg = `[bundle-size] FAIL: initial chunk is ${formatKb(overBudget)} OVER the budget (gzipped ${totalGz} > ${BUDGET_GZ}).`;
    if (enforce) {
      console.error(msg);
      process.exit(1);
    }
    console.warn(`[bundle-size] WARN: ${msg} (informational; pass --enforce to fail)`);
  } else {
    console.log(`[bundle-size] PASS: ${formatKb(-overBudget)} headroom under budget.`);
  }
}

main();
