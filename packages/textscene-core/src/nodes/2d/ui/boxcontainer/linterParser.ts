/**
 * BoxContainer's own validators, those doc/classes/BoxContainer.xml lists without
 * `overrides=`. Control's keys arrive through the NODE_BASE_TYPES walk, and a
 * re-declared one shadows it and duplicates the rule.
 */

import '../../../2d/ui/control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { CONTAINER_ALIGNMENT } from '../../../../linter/validators/containerAlignment.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('BoxContainer', {
  // box_container.cpp:379, PROPERTY_HINT_ENUM "Begin,Center,End", matching the bound
  // ALIGNMENT_* constants. set_alignment (box_container.cpp:299-305) assigns
  // unconditionally, no ERR_FAIL.
  alignment: v.enumInt('alignment', 0, 2, CONTAINER_ALIGNMENT, { hinted: 'box_container.cpp:379' }),
  // `_validate_property` (box_container.cpp) hides `vertical` only when `is_fixed`, which only the
  // HBoxContainer and VBoxContainer constructors set (box_container.h). A plain
  // BoxContainer serialises it.
  vertical: v.boolean('vertical'),
});
