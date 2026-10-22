#!/usr/bin/env node
/**
 * Vendors curated open-source Godot 4 games into scenes/games/<dir>/, a corpus of real-world
 * scene graphs beside the scenes/demos/ breadth corpus, which `pnpm vendor:demos` writes. Each
 * game is fetched at a pinned commit, pruned, and recorded with its licence in
 * scenes/games/README.md. Each keeps its own res:// namespace (a `root` per game in the manifest).
 * A key file names the recipe that made the corpus, so an unchanged recipe fetches nothing.
 *
 * @example
 *   node scripts/vendor-godot-games.mjs
 *   pnpm generate:fixtures
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { copyPruned } from './vendor-prune.mjs';
import { fetchShallow } from './vendor-git.mjs';
import { ensureKeyedCorpora } from './vendor-keyed.mjs';
import { REPO_ROOT } from './repoRoot.mjs';

const TARGET = join(REPO_ROOT, 'scenes/games');
const LOCK_FILE = join(REPO_ROOT, 'scenes/.vendor-godot-games.lock');

/** The files that decide the corpus, the pins below included. A change to one of them fetches again. */
const RECIPE = [
  'scripts/vendor-godot-games.mjs',
  'scripts/vendor-prune.mjs',
  'scripts/vendor-git.mjs',
  'scripts/vendor-keyed.mjs',
];

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

ensureKeyedCorpora({
  label: 'vendor-godot-games',
  corpora: [TARGET],
  recipe: RECIPE,
  lockFile: LOCK_FILE,
  vendor,
});

/** Fetches every game into a wiped scenes/games/ and writes its README. */
function vendor() {
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
      const files = copyPruned(src, join(TARGET, game.dir));
      totalFiles += files;
      summaries.push({ ...game, files });
      console.log(`vendored ${files} files`);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  writeFileSync(join(TARGET, 'README.md'), readme(summaries));
  console.log(`\n[vendor-godot-games] ${summaries.length} games, ${totalFiles} files`);
  console.log(
    '[vendor-godot-games] now run: pnpm generate:fixtures (or use `pnpm vendor:games`, which does both)'
  );
  return true;
}

/** The corpus README: each game with its pin and licence. */
function readme(summaries) {
  const rows = summaries
    .map(
      (g) =>
        `- **${g.name}** → \`scenes/games/${g.dir}/\` — Godot ${g.godot}\n` +
        `  - Source: ${g.url} @ \`${g.commit}\`\n` +
        `  - License: ${g.license}`
    )
    .join('\n');

  return `# Open-source Godot games (vendored)

Full community game projects copied in as the "proper games" corpus for
previewer QA: real-world scene graphs to check feature completeness and hunt
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

- \`scripts/vendor-godot-games.mjs\` vendors this folder. A change to a pinned
  \`commit\` in its \`GAMES\` array, or to the script, fetches again. The
  \`.vendor-key\` file names the recipe that made the folder.
- The vendoring prunes Godot editor artifacts (\`.godot/\`, \`screenshots/\`,
  the \`*.import\` sidecars the previewer does not read) and source art
  (\`*.psd\`, \`*.xcf\`, \`*.blend\`). It keeps each game's \`LICENSE\` and
  \`README.md\` verbatim for attribution.
- After running: \`pnpm generate:fixtures\`.
`;
}
