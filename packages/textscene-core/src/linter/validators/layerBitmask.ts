/**
 * The one validator for every Godot layer/mask property.
 *
 * All of them are hinted `PROPERTY_HINT_LAYERS_*`, which is a UI-control hint
 * rather than a `PROPERTY_HINT_RANGE`: the inspector renders a grid of 32
 * checkboxes, so the widget cannot express a negative value or one past
 * 2^32 - 1. Under ADR-0032 a UI-control hint grounds a WARNING, so that is what
 * an out-of-range mask reports.
 *
 * It is NOT an error. Every setter is a bare assignment
 * (collision_object_{2,3}d.cpp, ray_cast_{2,3}d.cpp, canvas_item.cpp,
 * light_2d.cpp, navigation_agent_3d.cpp, audio_stream_player_{2,3}d.cpp and the
 * rest), so a `.tscn` carrying `collision_layer = -1` loads and runs, with the
 * `uint32_t` parameter reinterpreting it as all-layers-on. That reinterpretation
 * is a language-level conversion, not a guard Godot's authors wrote, so it
 * cannot carry the error tier: reading an implicit cast as enforcement would
 * make every typed parameter in the engine a bound.
 *
 * The citation is per call site because the hint lives on each property's own
 * ADD_PROPERTY, and `core/object/object.h` (where the hint enum is declared) is
 * outside the sparse checkout this repo's citations are verified against.
 */

import { v, type Grounding } from './v.js';
import type { PropertyValidator } from '../ValidatorRegistry.js';

/** 2^32 - 1 — the widest value the 32-checkbox layer widget can express. */
export const MAX_LAYER_BITMASK = 4294967295;

/**
 * @param hinted - `file:line` of this property's own ADD_PROPERTY, the
 *   PROPERTY_HINT_LAYERS_* that states the width.
 */
export function layerBitmask(name: string, opts: Grounding = {}): PropertyValidator {
  const validator = v.int(name, {
    ...opts,
    min: 0,
    max: MAX_LAYER_BITMASK,
    message: `Property '${name}' must be between 0 and ${MAX_LAYER_BITMASK}. Valid range: 32-bit bitmask (layers 1-32)`,
  });
  // `integer` is what v.int tags it, but what matters to a reader of the
  // generated sheet is that the number is a layer mask.
  validator.accepts = '32-bit layer mask (layers 1-32)';
  return validator;
}
