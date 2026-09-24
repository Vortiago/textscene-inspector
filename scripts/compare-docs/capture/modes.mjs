/** Which workspace, 2D or 3D, a fixture is captured in, and where that came from. */

import { existsSync, readFileSync } from 'node:fs';
import { imagePath, modePath } from './paths.mjs';

export function readRecordedMode(imageFile) {
  const file = modePath(imageFile);
  if (!existsSync(file)) return null;
  const value = readFileSync(file, 'utf8').trim();
  return value === '2d' || value === '3d' ? value : null;
}

/**
 * The workspace each fixture is captured in, from Godot, or from the mode
 * recorded beside a skipped reference. A fixture with neither has nothing to
 * compare against, so it is not capturable. The previewer must agree, and a
 * disagreement is reported, not reconciled.
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
