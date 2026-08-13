/**
 * Strict parser validation for the material properties Godot declares on
 * `BaseMaterial3D`, entirely through the shared `v` combinators.
 *
 * Registered here and not on the `StandardMaterial3D` a scene names, because
 * this is the class the engine declares them on: while they sat on the leaf,
 * `ORMMaterial3D` inherited none of them and a guard looking a property up
 * under its declaring class saw nothing. The walk delivers them to both leaves
 * (classBaseTypes.ts).
 *
 * A validator-only directory rather than a Resource slice, since the class is
 * abstract and there is nothing to decode — the sibling of
 * `nodes/3d/lights/shared/` on the node side. One module per Godot property
 * group, because that is what a reader checking a citation is looking at.
 *
 * Format and bounds only. A cross-property check (`normal_enabled` without a
 * `normal_texture`, `distance_fade_min_distance` above its max) needs the
 * linter to walk SubResources rather than just nodes, which it does not yet do.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { featureKeys } from './features.js';
import { pbrKeys } from './pbr.js';
import { renderKeys } from './render.js';
import { stencilKeys } from './stencil.js';
import { surfaceKeys } from './surface.js';
import { uvKeys } from './uv.js';

validatorRegistry.registerAll('BaseMaterial3D', {
  ...surfaceKeys,
  ...pbrKeys,
  ...featureKeys,
  ...uvKeys,
  ...renderKeys,
  ...stencilKeys,
});
