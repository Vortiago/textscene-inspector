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
    else if (a === '--scene') opts.scene = argv[++i];
    else {
      console.error(`[visual] unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return opts;
}

/** The scenes this run covers: all of them, or the one `--scene` named. */
export function selectScenes(opts) {
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
    const ok = r.status === 'pass' || r.status === 'updated';
    if (!ok) failed++;
    const mark = ok ? '✓' : '✗';
    lines.push(`  ${mark} ${r.scene.name.padEnd(pad)}  ${r.status.toUpperCase()}  ${r.detail}`);
  }
  return { lines, failed };
}
