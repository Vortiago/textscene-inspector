/** Every location a batch capture reads or writes. */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = join(here, '../../..');
export const PLAN = join(here, '../plan.json');
// Beside the sheets that embed them, so a sheet's `![](images/...)` link is
// relative and the pair travels together.
export const IMAGES = join(REPO_ROOT, 'docs/comparison/images');

export const imagePath = (fixture, side) =>
  join(IMAGES, `${fixture.replace(/\.tscn$/, '')}-${side}.png`);

/**
 * Where a reference render's WORKSPACE is remembered, beside its image.
 *
 * The mode used to be inferred from the image's dimensions — 2D if it measured
 * exactly the capture frame. That only ever worked because every 2D capture was
 * the same size; now that a 2D frame is the scene's own
 * `display/window/size/viewport_*`, a 640x400 pong capture and a 1920x1080 RTS
 * capture would both read as '3d'. It would not fail, it would quietly build
 * the gallery against the wrong workspace, which is the worse outcome.
 *
 * Godot reports the mode itself (it is the side that classifies the root), so
 * the value is written here rather than re-derived.
 */
export const modePath = (imageFile) => `${imageFile}.mode`;
