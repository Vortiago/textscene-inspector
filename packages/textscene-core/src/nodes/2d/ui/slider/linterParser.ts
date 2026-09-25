/**
 * Validators for every Slider-derived node, the strict counterpart of `../shared/slider.ts`. The
 * key 'Slider' is never a node type (`ClassDB.can_instantiate("Slider")` is false), and it reaches
 * HSlider and VSlider through the NODE_BASE_TYPES base-walk. Neither binds a property of its own
 * (doc/classes/HSlider.xml and VSlider.xml list no member without `overrides=`).
 */

import '../range/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('Slider', {
  // slider.cpp:465
  editable: v.boolean('editable'),
  // slider.cpp:466
  scrollable: v.boolean('scrollable'),
  // slider.cpp:467: PROPERTY_HINT_RANGE "0,4096,1", with no `or_greater`/`or_less`, so both ends
  // are closed. set_ticks (slider.cpp:386-392) assigns unconditionally, with no ERR_FAIL.
  tick_count: v.int('tick_count', { min: 0, max: 4096, hinted: 'slider.cpp:467' }),
  // slider.cpp:468
  ticks_on_borders: v.boolean('ticks_on_borders'),
  // No bound: `slider.cpp:469` passes PROPERTY_HINT_ENUM with the default `""` hint string
  // (`object.h:181`), ADR-0032's "nothing" row. `set_ticks_position` (`slider.cpp:416-422`) neither
  // fails nor clamps, and BIND_ENUM_CONSTANT is no grounding the tier table admits.
  ticks_position: v.lenientInt('ticks_position'),
});
