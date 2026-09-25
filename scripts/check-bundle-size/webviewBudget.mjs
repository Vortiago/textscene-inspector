/**
 * The webview budget: walks the static import closure from `dist/webview/webview.js`, gzips the
 * concatenation and compares it with `BUDGET_GZ`. The webview builds as `esm` with splitting, so
 * dynamic `import()` (React.lazy) chunks stay off the canvas-paint critical path and do not count.
 */

import { gzipSync } from 'node:zlib';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ENTRY, WEBVIEW_DIR, formatKb } from './paths.mjs';

// The ceiling catches an accidental import that pulls a whole library into the canvas-paint
// path, not deliberate growth: every instantiable Godot node type bundles a parser (its linter
// half stays out), so a tighter ceiling fails on the next slice, not on a regression. The report
// reads growth against MEASURED_GZ, since growth inside the headroom is invisible in a PASS line.
const MEASURED_GZ = 607_514; // the 8-file closure as last measured
const BUDGET_GZ = 700_000; // absolute ceiling, gzipped

// Dead-weight chunks that must never ship in the VSIX. Importing the `@react-three/drei` barrel
// instead of `@react-three/drei/core/<Module>` bundles drei's video and face modules, whose
// `import('hls.js')` and `import('@mediapipe/tasks-vision')` emit about 656 KB of lazy chunks
// that no code path loads.
const DEAD_CHUNK_RE = /^(hls|vision_bundle)-/;

/**
 * Static imports of a JS file. Dynamic `import()` calls become a sentinel first, since those
 * chunks load on demand and stay out of the closure.
 */
function findStaticImports(content) {
  const stripped = content.replace(/import\([^)]*\)/g, '__DYN__()');
  const out = new Set();
  // `import ... from`, `export ... from` and `export * from`: a re-export pulls its target onto
  // the critical path as an import does. esbuild emits only the import form, and the gate must
  // not depend on that.
  const re1 = /(?:import|export)[^'";]*?from[^'"]*["']\.\/(?:chunks\/)?([^'"]+)["']/g;
  let m;
  while ((m = re1.exec(stripped))) out.add(m[1]);
  // bare side-effect import: import '...';
  const re2 = /(?:^|[;\s])import\s*["']\.\/(?:chunks\/)?([^'"]+)["']/g;
  while ((m = re2.exec(stripped))) out.add(m[1]);
  return out;
}

/**
 * Where an import specifier lands on disk, or `null`, which fails the gate instead of shrinking
 * the closure. The walker reproduces the bundler's layout rather than reading it, so it tries
 * both a chunk under `chunks/` and a sibling beside the entry.
 */
function resolveImport(dir, from, spec) {
  const bare = spec.split('/').pop();
  for (const candidate of [`chunks/${from === ENTRY ? spec : bare}`, bare, spec]) {
    if (existsSync(join(dir, candidate))) return candidate;
  }
  return null;
}

/**
 * Breadth-first walk of the static-import closure from `entry`: the files (relative to the
 * webview dir) on the canvas-paint path, and every specifier that resolved to nothing. An
 * unresolved import is reported, never skipped, or a layout the resolver stopped matching would
 * shrink the closure to the entry alone and still pass `--enforce`.
 */
function staticClosure(dir, entry) {
  const visited = new Set();
  const unresolved = new Set();
  const queue = [entry];
  while (queue.length > 0) {
    const f = queue.shift();
    if (visited.has(f)) continue;
    visited.add(f);
    const fp = join(dir, f);
    if (!existsSync(fp)) continue;
    const content = readFileSync(fp, 'utf8');
    for (const imp of findStaticImports(content)) {
      const target = resolveImport(dir, f, imp);
      if (target === null) unresolved.add(`${f} -> ${imp}`);
      else queue.push(target);
    }
  }
  return { visited, unresolved };
}

/**
 * Measures the initial-paint closure and prints the report. Every finding is
 * printed here, but the exit code is the caller's: the webview budget only
 * hard-fails under `--enforce`, while the host guard hard-fails always, so
 * only `main()` sees both halves.
 *
 * @param {boolean} enforce whether an over-budget closure is an error or a warning
 * @returns {'ok' | 'over-budget' | 'missing-entry' | 'dead-chunks' | 'unresolved-imports'}
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

  const { visited: closure, unresolved } = staticClosure(WEBVIEW_DIR, ENTRY);
  if (unresolved.size > 0) {
    console.error(
      `[bundle-size] FAIL: ${unresolved.size} import(s) resolved to no file on disk:`
    );
    for (const miss of unresolved) console.error(`  ${miss}`);
    console.error(
      '[bundle-size] the closure walk reproduces the bundler\'s output layout; update it before trusting the number.'
    );
    return 'unresolved-imports';
  }
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
  const sinceMeasured = totalGz - MEASURED_GZ;

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
  console.log(`Last measured:    ${formatKb(MEASURED_GZ)}  (${MEASURED_GZ} B)`);
  console.log(
    `Growth since:     ${sinceMeasured >= 0 ? '+' : ''}${formatKb(sinceMeasured)}  (${sinceMeasured} B)`
  );
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
