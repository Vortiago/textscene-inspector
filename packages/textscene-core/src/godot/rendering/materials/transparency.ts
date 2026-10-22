/** The transparency mode that picks how a BaseMaterial3D's alpha reaches the screen. */

import { enumNamesByValue } from '../../classdb/enumNames.js';

/**
 * `BaseMaterial3D::Transparency` (`scene/resources/material.h:187-193`), as the integers a `.tscn`
 * stores for `transparency`. The default is DISABLED (`material.h:570`).
 */
export const Transparency = {
  DISABLED: 0,
  /** Alpha blending, without depth writes, so surfaces behind stay visible. */
  ALPHA: 1,
  /** Hard cutout at `alpha_scissor_threshold`, on the opaque pass. */
  ALPHA_SCISSOR: 2,
  /** Stochastic cutout, on the opaque pass. */
  ALPHA_HASH: 3,
  /** Alpha blending after a depth prepass, so it DOES write depth. */
  ALPHA_DEPTH_PRE_PASS: 4,
} as const;

export const TRANSPARENCY_NAMES = enumNamesByValue(Transparency);
