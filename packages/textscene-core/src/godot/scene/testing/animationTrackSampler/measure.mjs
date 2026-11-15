/**
 * Writes `animationTrackSampler.godot.json`: what Godot's `Animation` samples for the position,
 * rotation and scale tracks that `dump.gd` builds, over each interpolation type, key easing and loop mode.
 *
 *   node measure.mjs [--godot /usr/local/bin/godot]
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { godotBinary, rounded } from '../../../testing/measureKit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(HERE, '../../animationTrackSampler.godot.json');
/** A `real_t` reads back as the same float from nine significant digits. */
const SIGNIFICANT_DIGITS = 9;

/** One line for each key and sample, so a regenerated file diffs by case. */
function formatted(cases) {
  const lines = Object.entries(cases).map(([name, track]) => {
    const rows = (list) => list.map((row) => JSON.stringify(row)).join(',\n    ');
    const { keys, samples, ...setup } = track;
    return `  ${JSON.stringify(name)}: {\n   ${JSON.stringify(setup).slice(1, -1)},\n   "keys": [\n    ${rows(keys)}\n   ],\n   "samples": [\n    ${rows(samples)}\n   ]\n  }`;
  });
  return `{\n${lines.join(',\n')}\n}\n`;
}

const project = mkdtempSync(join(tmpdir(), 'track-sampler-'));
try {
  writeFileSync(join(project, 'project.godot'), 'config_version=5\n');
  copyFileSync(join(HERE, 'dump.gd'), join(project, 'dump.gd'));
  const stdout = execFileSync(godotBinary(), ['--headless', '--path', project, '--script', 'dump.gd'], {
    encoding: 'utf8',
  });
  const json = stdout.slice(stdout.indexOf('SAMPLES\n') + 'SAMPLES\n'.length);
  writeFileSync(OUTPUT, formatted(rounded(JSON.parse(json), SIGNIFICANT_DIGITS)));
} finally {
  rmSync(project, { recursive: true, force: true });
}
