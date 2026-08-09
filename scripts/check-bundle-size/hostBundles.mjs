/**
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
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { relative } from 'node:path';
import { HOST_BUNDLE_PATHS, REPO_ROOT, formatKb } from './paths.mjs';

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
export function checkHostBundles() {
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
