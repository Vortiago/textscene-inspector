/**
 * The one bitmask validator for every Godot layer/mask property.
 *
 * Godot stores all of them — physics `collision_layer`/`collision_mask`,
 * render `cull_mask`/`layers`/`light_cull_mask`, navigation `avoidance_layers`
 * and friends — as **32-bit** masks. Only the first 20 render layers are
 * user-visible in the editor, which is where `1048575` (2^20 - 1) comes from:
 * it is `Camera3D.cull_mask`'s DEFAULT, never a maximum. Using it as a bound
 * rejected legal scenes — the vendored physics corpus writes `2147483654` and
 * `2147483648`, and it also rejected `Light3D.light_cull_mask`'s own Godot
 * default of `4294967295`.
 *
 * Sources: class_collisionobject2d/3d.html ("32 different layers",
 * `set_collision_layer_value` documented for layer_number 1..32),
 * class_light3d.html (`light_cull_mask` default 4294967295),
 * class_camera3d.html (`cull_mask` default 1048575, with a note that 32 layers
 * exist and the remaining 12 are engine-internal).
 */

import { v } from './v.js';
import type { PropertyValidator } from '../ValidatorRegistry.js';

/** 2^32 - 1 — the largest value any Godot layer/mask property can hold. */
export const MAX_LAYER_BITMASK = 4294967295;

/**
 * Validator for a 32-bit layer/mask property. `0` is legal everywhere (it
 * simply means "no layers"), so there is no lower bound to configure.
 */
export function layerBitmask(name: string): PropertyValidator {
  return v.int(name, {
    min: 0,
    max: MAX_LAYER_BITMASK,
    message: `Property '${name}' must be between 0 and ${MAX_LAYER_BITMASK}. Valid range: 32-bit bitmask (layers 1-32)`,
  });
}
