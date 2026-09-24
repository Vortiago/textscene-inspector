/**
 * The harness's command line: what the flags mean, which scenes they select and how the run
 * reports. It has no browser and no filesystem, so a test can run it without launching anything.
 */

import { GOLDEN_SCENES } from '../scenes.mjs';

/** Parses `--update` and `--scene <name>`. Anything else is a usage error (exit 2). */
export function parseArgs(argv) {
  const opts = { update: false, scene: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--update') opts.update = true;
    else if (a === '--scene') {
      // A missing value would fall through to "no scene named", which runs every scene and, under
      // --update, rewrites every baseline.
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

/**
 * `GOLDEN_SCENES` spreads the per-chapter arrays, so an emptied chapter or an array nothing
 * gathers shortens the run silently, and `summarize([])` counts no failures, so `PASS: 0/0` exits 0.
 */
const MIN_GOLDEN_SCENES = 100;

/** The scenes this run covers: all of them, or the one `--scene` named. */
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
