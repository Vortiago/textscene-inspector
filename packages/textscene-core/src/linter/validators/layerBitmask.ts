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
 * ## And there is no numeric bound left to warn about either
 *
 * 32 checkboxes express every 32-bit pattern, and every literal an int slot can
 * hold IS one, so the old `{ min: 0, max: 4294967295 }` could only ever fire on
 * a spelling rather than on a value. It did: measured on 4.6.3,
 * `Node2D.light_mask = -1` stores -1 and `visibility_layer = -1` is written
 * back by Godot's own serialiser as `4294967295` — the same 32 bits, two
 * spellings, and the bound rejected one of them. Widths differ per property
 * (`VisualInstance3D::set_layer_mask` takes `uint32_t`,
 * `visual_instance_3d.h:72-73`; `CanvasItem::set_light_mask` takes `int`,
 * `canvas_item.h:278`), which decides which spelling Godot writes and nothing
 * about which values are legal.
 *
 * What remains is the INT-slot refusal every integer combinator carries: a
 * literal past the 32-bit band states bits the engine does not hold.
 *
 * The citation is per call site because the hint lives on each property's own
 * ADD_PROPERTY, and `core/object/object.h` (where the hint enum is declared) is
 * outside the sparse checkout this repo's citations are verified against.
 */

import { v, type Grounding } from './v.js';
import type { PropertyValidator } from '../ValidatorRegistry.js';

/**
 * @param hinted - `file:line` of this property's own ADD_PROPERTY, the
 *   PROPERTY_HINT_LAYERS_* that states the width. Kept even though no bound
 *   rides on it: it is what a reader checks the "32 layers" claim against.
 */
export function layerBitmask(name: string, opts: Grounding = {}): PropertyValidator {
  const validator = v.int(name, opts);
  // `integer` is what v.int tags it, but what matters to a reader of the
  // generated sheet is that the number is a layer mask.
  validator.accepts = '32-bit layer mask (layers 1-32)';
  return validator;
}
