/**
 * Validators shared by every Slider-derived node.
 *
 * Registered under the key 'Slider', which is never a node type of its own:
 * `ClassDB.can_instantiate("Slider")` is false and a GDScript cannot inherit
 * from it either, so no scene holds one. It exists here only to reach HSlider
 * and VSlider through the NODE_BASE_TYPES base-walk, both of which bind no
 * properties of their own: doc/classes/HSlider.xml and VSlider.xml list zero
 * members without an `overrides=` attribute, and neither .cpp calls
 * ADD_PROPERTY. Their whole serialisable surface below Range is this set,
 * which went unchecked until the tier existed.
 *
 * The shared *parser* for the same class is `../shared/slider.ts`; this is its
 * strict-parser counterpart.
 */

import '../range/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('Slider', {
  // slider.cpp:465
  editable: v.boolean('editable'),
  // slider.cpp:466
  scrollable: v.boolean('scrollable'),
  // slider.cpp:467 — PROPERTY_HINT_RANGE "0,4096,1", neither end softened by
  // `or_greater`/`or_less`, so both are hard bounds. set_ticks (slider.cpp:386-392)
  // assigns unconditionally, no ERR_FAIL.
  tick_count: v.int('tick_count', { min: 0, max: 4096, hinted: 'slider.cpp:467' }),
  // slider.cpp:468
  ticks_on_borders: v.boolean('ticks_on_borders'),
  // No bound: `slider.cpp:469` passes PROPERTY_HINT_ENUM with no hint string, so
  // `p_hint_string` defaults to `""` (`object.h:181`) and the hint states
  // nothing — ADR-0032's "nothing" row. `set_ticks_position`
  // (`slider.cpp:416-422`) assigns past an equality guard with no ERR_FAIL and
  // no clamp, so there is no enforced tier either, and BIND_ENUM_CONSTANT is
  // not a grounding the tier table admits.
  ticks_position: v.lenientInt('ticks_position'),
});
