#!/usr/bin/env node
/**
 * Vendor the visual godot-demo-projects categories into scenes/demos/.
 *
 * Usage:
 *   node scripts/vendor-godot-demos.mjs <path-to-godot-demo-projects-checkout>
 *
 * Copies every project under 2d/, 3d/, gui/, viewport/ into
 * scenes/demos/<top>/<project>/, pruning Godot editor artifacts and source
 * art that the previewer never reads. `2d/isometric` is skipped — it is
 * vendored standalone at scenes/isometric/ as the TileMapLayer integration
 * corpus and pinned by tests there.
 *
 * Re-runnable: wipes scenes/demos/ first, then copies fresh, and records the
 * source commit in scenes/demos/README.md. After running:
 *   pnpm generate:fixtures
 */

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPruned } from './vendor-prune.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = join(REPO_ROOT, 'scenes/demos');
const TOPS = ['2d', '3d', 'gui', 'viewport'];
const SKIP_PROJECTS = new Set(['2d/isometric']);

const source = process.argv[2];
if (!source || !existsSync(source)) {
  console.error('usage: node scripts/vendor-godot-demos.mjs <godot-demo-projects checkout>');
  process.exit(1);
}

let commit = 'unknown';
try {
  commit = execSync('git rev-parse HEAD', { cwd: source }).toString().trim();
} catch {
  // Not a git checkout — record as unknown.
}

rmSync(TARGET, { recursive: true, force: true });

let projects = 0;
let files = 0;
for (const top of TOPS) {
  const topDir = join(source, top);
  if (!existsSync(topDir)) {
    console.warn(`[vendor-godot-demos] missing ${top}/ in source — skipped`);
    continue;
  }
  for (const entry of readdirSync(topDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (SKIP_PROJECTS.has(`${top}/${entry.name}`)) {
      console.log(`  skip    ${top}/${entry.name} (vendored standalone at scenes/isometric/)`);
      continue;
    }
    const dest = join(TARGET, top, entry.name);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(join(topDir, entry.name), dest, {
      recursive: true,
      filter: (src) => {
        if (isPruned(src)) return false;
        files++;
        return true;
      },
    });
    projects++;
    console.log(`  vendor  ${top}/${entry.name}`);
  }
}

writeFileSync(
  join(TARGET, 'README.md'),
  `# Godot demo projects (vendored)

The visual categories (2d/, 3d/, gui/, viewport/) of
[godotengine/godot-demo-projects](https://github.com/godotengine/godot-demo-projects),
vendored as a breadth corpus for previewer QA — every scene is selectable in
the web previewer under the "Godot Demos - …" categories, each project keeping
its own res:// namespace (see the fixture manifest's \`root\` field).

- Source commit: ${commit}
- Vendored by: \`scripts/vendor-godot-demos.mjs\` (re-run against a fresh
  checkout to update; editor artifacts (*.import, .godot/, screenshots/) and
  source art (*.psd, *.xcf, *.blend) are pruned)
- \`2d/isometric\` is intentionally absent — it lives at \`scenes/isometric/\`
  as the TileMapLayer integration corpus (issue #74).

License: code is MIT — Copyright (c) 2014-present Godot Engine contributors,
Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur
(https://github.com/godotengine/godot-demo-projects/blob/master/LICENSE.md).
Per-demo asset licenses vary (often CC-BY) — each project's README.md is kept
verbatim for attribution.
`
);

console.log(`[vendor-godot-demos] ${projects} projects, ${files} files @ ${commit.slice(0, 12)}`);
console.log('[vendor-godot-demos] now run: pnpm generate:fixtures');
