/** Every location a batch capture reads or writes. */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IMAGES_DIR, REPO_ROOT } from '../sheetSources.mjs';

const here = dirname(fileURLToPath(import.meta.url));

export const PLAN = join(here, '../plan.json');
// From `sheetSources.mjs`, not re-derived: capture and recapture WRITE into
// this directory and the gallery READS from it, so a second spelling of it
// fails by putting pictures somewhere nothing looks, with nothing to report.
export { REPO_ROOT };
export const IMAGES = IMAGES_DIR;

export const imagePath = (fixture, side) =>
  join(IMAGES, `${fixture.replace(/\.tscn$/, '')}-${side}.png`);

/**
 * Where a reference render's WORKSPACE is remembered, beside its image.
 *
 * Inferring the mode from the image's dimensions — 2D if it measures exactly
 * the capture frame — only works while every 2D capture is the same size. A 2D
 * frame is the scene's own
 * `display/window/size/viewport_*`, a 640x400 pong capture and a 1920x1080 RTS
 * capture would both read as '3d'. It would not fail, it would quietly build
 * the gallery against the wrong workspace, which is the worse outcome.
 *
 * Godot reports the mode itself (it is the side that classifies the root), so
 * the value is written here rather than re-derived.
 */
export const modePath = (imageFile) => `${imageFile}.mode`;
