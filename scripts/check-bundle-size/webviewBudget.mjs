/**
 * Walks the static import closure starting from `dist/webview/webview.js`,
 * gzips the concatenation, and compares against the absolute
 * budget (`BUDGET_GZ`). Dynamic `import()` (React.lazy) chunks are
 * deliberately excluded — they don't load on the canvas-paint critical
 * path, so they don't count against this budget.
 *
 * The webview build was flipped from `iife` to `esm` + splitting so
 * React.lazy could actually code-split. Before that flip
 * the entire bundle was the initial chunk (4.1 MB raw / 717 KB gzipped
 * unminified, or 1.4 MB raw / ~620 KB gzipped minified).
 */

import { gzipSync } from 'node:zlib';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ENTRY, WEBVIEW_DIR, formatKb } from './paths.mjs';

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
// - Raised 2026-08-07 to 700 kB. The node-coverage run registers a parser for
//   every one of Godot's 240 instantiable node types, and each registration is
//   bundled code even though its linter half is not, so the closure grew to
//   592,721 B gz with 7.1 KB left. The ceiling guards against an accidental
//   import pulling a whole library in; it was never meant to cap deliberate,
//   measured per-type growth, and a limit that tight would fail on the next
//   slice rather than on a real regression.
// MAIN_BASELINE_GZ (the pre-merge measurement of `main` from the original
// budget) is kept only for the informational delta-vs-main report line.
const MAIN_BASELINE_GZ = 247_543;
const BUDGET_GZ = 700_000; // absolute ceiling, gzipped

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

/**
 * Measures the initial-paint closure and prints the report. Every finding is
 * printed here, but the exit code is the caller's: the webview budget only
 * hard-fails under `--enforce`, while the host guard hard-fails always, so
 * only `main()` sees both halves.
 *
 * @param {boolean} enforce whether an over-budget closure is an error or a warning
 * @returns {'ok' | 'over-budget' | 'missing-entry' | 'dead-chunks'}
 */
export function checkWebviewBudget(enforce) {
  if (!existsSync(join(WEBVIEW_DIR, ENTRY))) {
    console.error(`\n[bundle-size] entry not found: ${join(WEBVIEW_DIR, ENTRY)}`);
    console.error('[bundle-size] run `pnpm --filter textscene-inspector build` first');
    return 'missing-entry';
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
    return 'dead-chunks';
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
  if (overBudget > 0) {
    const msg = `[bundle-size] FAIL: initial chunk is ${formatKb(overBudget)} OVER the budget (gzipped ${totalGz} > ${BUDGET_GZ}).`;
    if (enforce) {
      console.error(msg);
    } else {
      console.warn(`[bundle-size] WARN: ${msg} (informational; pass --enforce to fail)`);
    }
    return 'over-budget';
  }
  console.log(`[bundle-size] PASS: ${formatKb(-overBudget)} headroom under budget.`);
  return 'ok';
}
