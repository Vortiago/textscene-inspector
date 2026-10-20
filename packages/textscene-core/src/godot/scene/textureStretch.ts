/** The stretch mode TextureButton and TextureRect share. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/**
 * `TextureButton.StretchMode` and `TextureRect.StretchMode` (`texture_button.h:39-47`,
 * `texture_rect.h:48-56`). Neither setter enforces the range, so both bounds
 * are hinted, each citing its own `ADD_PROPERTY`.
 */
export enum TextureStretchMode {
  STRETCH_SCALE = 0,
  STRETCH_TILE = 1,
  STRETCH_KEEP = 2,
  STRETCH_KEEP_CENTERED = 3,
  STRETCH_KEEP_ASPECT = 4,
  STRETCH_KEEP_ASPECT_CENTERED = 5,
  STRETCH_KEEP_ASPECT_COVERED = 6,
}

export const TEXTURE_STRETCH_MODE_NAMES = enumNamesByValue(TextureStretchMode);
