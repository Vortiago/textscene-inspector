/**
 * Validators shared by every Slider-derived node.
 *
 * Registered under the abstract key 'Slider', which Godot cannot instantiate,
 * so it appears in no .tscn and owns no slice. It reaches HSlider and VSlider
 * through the NODE_BASE_TYPES base-walk, both of which bind no properties of
 * their own: doc/classes/HSlider.xml and VSlider.xml list zero members without
 * an `overrides=` attribute, and neither .cpp calls ADD_PROPERTY. Their whole
 * serialisable surface below Range is this set, which went unchecked until the
 * tier existed.
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
  // `or_greater`/`or_less`, so both are hard bounds.
  tick_count: v.int('tick_count', { min: 0, max: 4096 }),
  // slider.cpp:468
  ticks_on_borders: v.boolean('ticks_on_borders'),
  // slider.cpp:469 — PROPERTY_HINT_ENUM carries no hint string, so the four
  // BIND_ENUM_CONSTANT lines (slider.cpp:471-474, values from slider.h:39-44)
  // are the only statement of the range.
  ticks_position: v.enumInt('ticks_position', 0, 3, {
    0: 'TICK_POSITION_BOTTOM_RIGHT',
    1: 'TICK_POSITION_TOP_LEFT',
    2: 'TICK_POSITION_BOTH',
    3: 'TICK_POSITION_CENTER',
  }),
});
