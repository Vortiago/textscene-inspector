/**
 * The harness's command line: what the flags mean, which scenes they select,
 * and how the run reports back.
 *
 * Kept pure (no browser, no filesystem) so the argument contract and the
 * summary formatting are exercisable without launching anything.
 */

import { GOLDEN_SCENES } from '../scenes.mjs';

/** Parse `--update` / `--scene <name>`; anything else is a usage error (exit 2). */
export function parseArgs(argv) {
  const opts = { update: false, scene: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--update') opts.update = true;
    else if (a === '--scene') {
      // A missing value must not fall through to "no scene named", which runs
      // — and under --update REWRITES — all 145 baselines.
      const value = argv[++i];
      if (value === undefined || value === '') {
        console.error('[visual] --scene needs a scene name');
        process.exit(2);
      }
      opts.scene = value;
    }
    else {
      console.error(`[visual] unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return opts;
}

/** The scenes this run covers: all of them, or the one `--scene` named. */
/**
 * The floor every other ledger in this repo carries, and the one harness that
 * owns the largest artifact set did not: `GOLDEN_SCENES` is the spread of eight
 * per-chapter arrays, so a chapter that empties — or a rename that leaves an
 * exported array nothing accumulates into — silently shortens the run.
 * `summarize([])` counts no failures, so the harness printed `PASS: 0/0 scenes`
 * and exited 0 with 145 committed baselines guarded by nothing.
 */
const MIN_GOLDEN_SCENES = 100;

export function selectScenes(opts) {
  if (GOLDEN_SCENES.length < MIN_GOLDEN_SCENES) {
    console.error(
      `[visual] only ${GOLDEN_SCENES.length} golden scene(s) registered, below the ` +
        `floor of ${MIN_GOLDEN_SCENES}. A chapter under scripts/visual/scenes/ is ` +
        `empty or no longer reaches the manifest.`
    );
    process.exit(2);
  }
  if (!opts.scene) return GOLDEN_SCENES;
  const scenes = GOLDEN_SCENES.filter((s) => s.name === opts.scene);
  if (scenes.length === 0) {
    console.error(
      `[visual] unknown scene "${opts.scene}". Known: ${GOLDEN_SCENES.map((s) => s.name).join(', ')}`
    );
    process.exit(2);
  }
  return scenes;
}

/** Column-aligned result lines plus the count that decides the exit code. */
export function summarize(results) {
  const pad = Math.max(...results.map((r) => r.scene.name.length));
  const lines = [];
  let failed = 0;
  for (const r of results) {
    const ok = r.status === 'pass' || r.status === 'updated' || r.status === 'unchanged';
    if (!ok) failed++;
    const mark = ok ? '✓' : '✗';
    lines.push(`  ${mark} ${r.scene.name.padEnd(pad)}  ${r.status.toUpperCase()}  ${r.detail}`);
  }
  return { lines, failed };
}
