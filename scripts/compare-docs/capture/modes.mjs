/** Which workspace — 2D or 3D — a fixture is captured in, and where that came from. */

import { existsSync, readFileSync } from 'node:fs';
import { imagePath, modePath } from './paths.mjs';

export function readRecordedMode(imageFile) {
  const file = modePath(imageFile);
  if (!existsSync(file)) return null;
  const value = readFileSync(file, 'utf8').trim();
  return value === '2d' || value === '3d' ? value : null;
}

/**
 * The workspace each fixture is captured in, from the side that knows: Godot.
 * A fixture the reference pass skipped takes it from the mode RECORDED beside
 * that reference — and one with neither is not capturable, because there is
 * nothing to compare it against anyway. A cached image from before the mode was
 * recorded lands there too, which re-renders it rather than guessing.
 */
export function resolveModes(fixtures, godotModes) {
  const modes = new Map();
  const unknown = [];
  for (const fixture of fixtures) {
    const reported = godotModes.get(fixture);
    if (reported) {
      modes.set(fixture, reported);
      continue;
    }
    const reference = imagePath(fixture, 'godot');
    const recorded = existsSync(reference) ? readRecordedMode(reference) : null;
    if (recorded) modes.set(fixture, recorded);
    else unknown.push(fixture);
  }
  return { modes, unknown };
}
