/** The stretch mode TextureButton and TextureRect share. */

/**
 * `TextureButton.StretchMode` and `TextureRect.StretchMode` (`texture_button.h:39-47`,
 * `texture_rect.h:48-56`). Neither setter enforces the range, so both bounds
 * are hinted, each citing its own `ADD_PROPERTY`.
 */
export const TEXTURE_STRETCH_MODE = {
  0: 'STRETCH_SCALE',
  1: 'STRETCH_TILE',
  2: 'STRETCH_KEEP',
  3: 'STRETCH_KEEP_CENTERED',
  4: 'STRETCH_KEEP_ASPECT',
  5: 'STRETCH_KEEP_ASPECT_CENTERED',
  6: 'STRETCH_KEEP_ASPECT_COVERED',
} as const;
