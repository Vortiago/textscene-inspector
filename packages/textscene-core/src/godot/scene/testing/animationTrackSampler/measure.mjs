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
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(HERE, '../../animationTrackSampler.godot.json');
const SIGNIFICANT_DIGITS = 9;

function godotBinary() {
  const flag = process.argv.indexOf('--godot');
  return flag === -1 ? 'godot' : process.argv[flag + 1];
}

/** A `real_t` prints with the digits that read back as the same float. */
function rounded(value) {
  if (Array.isArray(value)) return value.map(rounded);
  if (typeof value === 'number') return Number(value.toPrecision(SIGNIFICANT_DIGITS));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, rounded(entry)]));
  }
  return value;
}

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
  writeFileSync(OUTPUT, formatted(rounded(JSON.parse(json))));
} finally {
  rmSync(project, { recursive: true, force: true });
}
