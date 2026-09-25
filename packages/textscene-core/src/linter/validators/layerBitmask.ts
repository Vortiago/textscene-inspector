/**
 * The validator for every Godot layer/mask property. Each is hinted `PROPERTY_HINT_LAYERS_*`,
 * 32 checkboxes that express every 32-bit pattern, so no numeric bound is left: only the
 * INT-slot refusal of a literal past the 32-bit band. The cite is per call site, since
 * `core/object/object.h`, which declares the hint enum, is outside the verified sparse checkout.
 */

import { v, type Grounding } from './v.js';
import type { IntWidth } from '../../godot/index.js';
import type { PropertyValidator } from '../ValidatorRegistry.js';

/**
 * No bound errors: each setter is a bare assignment (collision_object_{2,3}d.cpp, ray_cast_{2,3}d.cpp,
 * canvas_item.cpp, light_2d.cpp, navigation_agent_3d.cpp, audio_stream_player_{2,3}d.cpp), and a
 * `uint32_t` parameter's implicit cast is not a guard. The width decides only the spelling Godot
 * writes: `light_mask = -1` (`int`, `canvas_item.h:278`) stays -1, `visibility_layer = -1` saves as `4294967295`.
 *
 * @param hinted - `file:line` of this property's own ADD_PROPERTY, the
 *   PROPERTY_HINT_LAYERS_* that states the width. Kept even though no bound
 *   rides on it: it is what a reader checks the "32 layers" claim against.
 * @param width - the setter's C++ parameter type, cited per call site.
 */
export function layerBitmask(
  name: string,
  opts: Grounding & { width: IntWidth }
): PropertyValidator {
  // The width is required, not inferred: `slotWidth` reads int32 for a slot with
  // no ceiling and would refuse `Camera3D.cull_mask = 3e9`. `set_visibility_layer`
  // takes `uint32_t` (`canvas_item.h:288`), as `set_layer_mask` does (`visual_instance_3d.h:72-73`),
  // while `set_light_mask` takes `int` (`canvas_item.h:278`).
  const validator = v.int(name, opts);
  // The sheet's reader needs to know the number is a layer mask, not `integer`.
  validator.accepts = '32-bit layer mask (layers 1-32)';
  return validator;
}
