/**
 * The extension host (`src/extension.ts`, bundled as `dist/extension.js` for desktop VS Code and
 * `dist/extension.web.js` for vscode.dev) imports only React-free `@textscene/core` subpaths
 * (`/parser`, `/linter`, `/logger`, targeted resource utils), never the root barrel: its React and
 * CSS side effects defeat tree-shaking and grow the host about 4x (ARCHITECTURE.md, "Bundle Size Target").
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { relative } from 'node:path';
import { HOST_BUNDLE_PATHS, REPO_ROOT, formatKb } from './paths.mjs';

const HOST_FORBIDDEN_WORDS = ['react', 'three'];

/**
 * Whole-word `react` / `three` tokens in host-bundle text. `\bWORD\b` matches `require("react")`,
 * `"react-dom"`, `from"three"` and `three/examples/...`, but not "reactive", "reaction",
 * "overreacted", "threefold" or "threescore". This is the fallback when no metafile exists, and a
 * string literal such as "expected three arguments" trips it.
 */
export function findHostBundleViolations(content) {
  return HOST_FORBIDDEN_WORDS.filter((word) => new RegExp(`\\b${word}\\b`, 'i').test(content));
}

/**
 * Any react/three ecosystem module bundled into the host, per the esbuild metafile's `inputs`.
 * It matches the package segment after `node_modules/`, pnpm's nested
 * `node_modules/.pnpm/.../node_modules/react/` included, so no source file or string can match.
 */
export function findForbiddenHostInputs(metafile) {
  // The trailing slash anchors `three`, so it does not match `three-bvh-csg/` or
  // `three-mesh-bvh/`, which drei depends on. Both are listed by name.
  const forbidden =
    /node_modules\/(react|react-dom|scheduler|three|three-bvh-csg|three-mesh-bvh|@react-three)\//;
  return Object.keys(metafile.inputs ?? {}).filter((input) => forbidden.test(input));
}

/**
 * Asserts every path in `HOST_BUNDLE_PATHS` is free of `react`/`three`, with no `--enforce` gate:
 * this is a binary invariant. It prefers the esbuild metafile (`dist/*.meta.json`, written by
 * esbuild.config.mjs) and falls back to the token scan without one. Returns `false`, never
 * throws, so `main()` reports every finding before it picks the exit code.
 */
export function checkHostBundles() {
  console.log('\n=== VS Code extension HOST bundles (must stay React/THREE-free) ===');
  let ok = true;
  for (const bundlePath of HOST_BUNDLE_PATHS) {
    const rel = relative(REPO_ROOT, bundlePath);
    if (!existsSync(bundlePath)) {
      // Fail, not skip: an unmeasured bundle looks like a clean one, so a renamed esbuild
      // `outfile` would otherwise pass having inspected nothing.
      console.error(
        `[bundle-size] FAIL: ${rel} not found, so it was never checked — build the extension first.`
      );
      ok = false;
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
      // Fallback for a build without dist/*.meta.json.
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
