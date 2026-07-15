#!/usr/bin/env node
/**
 * Vendor a curated set of open-source Godot 4 *games* into scenes/games/.
 *
 * Unlike scenes/demos/ (the breadth corpus from godot-demo-projects) this is
 * the "proper games" corpus: full community game projects copied in so the
 * previewer can be exercised against real-world scene graphs — for feature-
 * completeness checks and bug hunting — instead of only tiny fixtures.
 *
 * Usage:
 *   node scripts/vendor-godot-games.mjs
 *
 * Self-contained and re-runnable: shallow-fetches each game at a PINNED commit
 * into a temp dir, prunes Godot editor artifacts and source art the previewer
 * never reads, copies the result into scenes/games/<dir>/, and records the
 * pinned commits + licenses in scenes/games/README.md. Each game keeps its own
 * res:// namespace (the fixture manifest carries a `root` per game). After
 * running:
 *   pnpm generate:fixtures
 *
 * Kept SEPARATE from scenes/demos/ on purpose: vendor-godot-demos.mjs wipes
 * scenes/demos/ on every run, which would otherwise clobber these.
 */

import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { isPruned } from './vendor-prune.mjs';
import { fetchShallow } from './vendor-git.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = join(REPO_ROOT, 'scenes/games');

/**
 * The curated games, pinned to a specific commit for reproducible vendoring.
 * `dir` is the scenes/games/<dir> destination (and the res:// root prefix).
 */
const GAMES = [
  {
    dir: 'kenney-platformer',
    name: 'Kenney Starter Kit 3D Platformer',
    url: 'https://github.com/KenneyNL/Starter-Kit-3D-Platformer',
    commit: '3fa8a04b1c01ab23db43123d4ce814a34c3fc7f0',
    godot: '4.6',
    license: 'MIT (code) — game art is Kenney CC0. See LICENSE.md.',
  },
  {
    dir: 'godot-open-rpg',
    name: 'GDQuest Open RPG',
    url: 'https://github.com/gdquest-demos/godot-open-rpg',
    commit: '19bd328fae9e4b534d3bb6db380a3d871d6ea58f',
    godot: '4.6',
    license: 'MIT — see LICENSE (GDQuest art assets are typically CC-BY 4.0).',
  },
  {
    dir: 'godot-open-rts',
    name: 'lampe-games Open RTS',
    url: 'https://github.com/lampe-games/godot-open-rts',
    commit: 'a628ad3bb6a9a903587a181a7ee3300dbf735e81',
    godot: '4.3',
    license: 'MIT — see LICENSE (logo assets: see LOGO_LICENSES.md).',
  },
];

const work = mkdtempSync(join(tmpdir(), 'vendor-godot-games-'));
rmSync(TARGET, { recursive: true, force: true });
mkdirSync(TARGET, { recursive: true });

let totalFiles = 0;
const summaries = [];
try {
  for (const game of GAMES) {
    const src = join(work, game.dir);
    process.stdout.write(`  fetch   ${game.dir} @ ${game.commit.slice(0, 12)} … `);
    fetchShallow(game.url, game.commit, src);
    const dest = join(TARGET, game.dir);
    let files = 0;
    cpSync(src, dest, {
      recursive: true,
      filter: (p) => {
        if (isPruned(p)) return false;
        files++;
        return true;
      },
    });
    totalFiles += files;
    summaries.push({ ...game, files });
    console.log(`vendored ${files} files`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

const rows = summaries
  .map(
    (g) =>
      `- **${g.name}** → \`scenes/games/${g.dir}/\` — Godot ${g.godot}\n` +
      `  - Source: ${g.url} @ \`${g.commit}\`\n` +
      `  - License: ${g.license}`
  )
  .join('\n');

writeFileSync(
  join(TARGET, 'README.md'),
  `# Open-source Godot games (vendored)

Full community game projects copied in as the "proper games" corpus for
previewer QA — real-world scene graphs to check feature completeness and hunt
bugs against, beyond the tiny fixtures and the godot-demo-projects breadth
corpus (\`scenes/demos/\`).

Every game keeps its own \`res://\` namespace: the web previewer mirrors each
under \`public/fixtures/games/<dir>/\` and resolves \`res://\` against the
fixture manifest's \`root\` field. Scenes are browsable in the selector under
the "Games - …" categories (editor scenes under \`addons/\` are kept on disk so
references resolve, but are not listed as selectable fixtures).

## Vendored games

${rows}

## Maintenance

- Vendored by \`scripts/vendor-godot-games.mjs\` (re-run to refresh; bump the
  pinned \`commit\` in the \`GAMES\` array to update a game). Godot editor
  artifacts (\`*.import\`, \`.godot/\`, \`screenshots/\`) and source art
  (\`*.psd\`, \`*.xcf\`, \`*.blend\`) are pruned; each game's \`LICENSE\` and
  \`README.md\` are kept verbatim for attribution.
- After running: \`pnpm generate:fixtures\`.
`
);

console.log(`\n[vendor-godot-games] ${summaries.length} games, ${totalFiles} files`);
console.log('[vendor-godot-games] now run: pnpm generate:fixtures (or use `pnpm vendor:games`, which does both)');
