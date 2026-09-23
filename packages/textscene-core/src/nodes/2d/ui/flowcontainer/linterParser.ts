/**
 * FlowContainer strict validators. They declare only the members that
 * doc/classes/FlowContainer.xml lists without `overrides=`: the NODE_BASE_TYPES
 * base-walk delivers the inherited keys, and a redeclared key shadows its ancestor.
 */

import '../../../2d/ui/control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { CONTAINER_ALIGNMENT } from '../../../../linter/validators/containerAlignment.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('FlowContainer', {
  // flow_container.cpp:418, PROPERTY_HINT_ENUM "Begin,Center,End", values 0-2
  // (flow_container.cpp:410-412), default 0 (doc/classes/FlowContainer.xml).
  // set_alignment (flow_container.cpp:347-353) assigns unconditionally.
  alignment: v.enumInt('alignment', 0, 2, CONTAINER_ALIGNMENT, {
    hinted: 'flow_container.cpp:418',
  }),
  // flow_container.cpp:419, PROPERTY_HINT_ENUM "Inherit,Begin,Center,End", values 0-3
  // (flow_container.cpp:413-416), default 0 (doc/classes/FlowContainer.xml).
  // set_last_wrap_alignment (flow_container.cpp:359-365) assigns unconditionally.
  last_wrap_alignment: v.enumInt(
    'last_wrap_alignment',
    0,
    3,
    {
      0: 'LAST_WRAP_ALIGNMENT_INHERIT',
      1: 'LAST_WRAP_ALIGNMENT_BEGIN',
      2: 'LAST_WRAP_ALIGNMENT_CENTER',
      3: 'LAST_WRAP_ALIGNMENT_END',
    },
    { hinted: 'flow_container.cpp:419' }
  ),
  // flow_container.cpp:420. `_validate_property` hides it only `if (is_fixed && ...)`
  // (flow_container.cpp:333-336). A plain FlowContainer leaves `is_fixed` false (flow_container.h:69,
  // flow_container.cpp:394-396), and only the H and V constructors set it (flow_container.h:104,112).
  vertical: v.boolean('vertical'),
  // flow_container.cpp:421
  reverse_fill: v.boolean('reverse_fill'),
});
