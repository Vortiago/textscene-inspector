/** Every location a batch capture reads or writes. */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IMAGES_DIR, REPO_ROOT } from '../sheetSources.mjs';

const here = dirname(fileURLToPath(import.meta.url));

export const PLAN = join(here, '../plan.json');
// From `sheetSources.mjs`, not re-derived: the captures write here and the
// gallery reads here, so a second spelling loses pictures silently.
export { REPO_ROOT };
export const IMAGES = IMAGES_DIR;

export const imagePath = (fixture, side) =>
  join(IMAGES, `${fixture.replace(/\.tscn$/, '')}-${side}.png`);

/**
 * Where a reference render's workspace is recorded, beside its image. The image
 * size cannot tell: a 2D frame is the scene's `display/window/size/viewport_*`,
 * so any size is possible. Godot reports the mode, so it is written, not derived.
 */
export const modePath = (imageFile) => `${imageFile}.mode`;
