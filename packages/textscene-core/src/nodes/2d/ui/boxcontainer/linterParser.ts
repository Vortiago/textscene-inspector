/**
 * BoxContainer strict validators for linting.
 *
 * Declare only BoxContainer's OWN members — the ones doc/classes/BoxContainer.xml
 * lists without an `overrides=` attribute. Everything from Control up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * `vertical`'s serialisation is instance-dependent: `BoxContainer::_validate_property`
 * (box_container.cpp) sets `PROPERTY_USAGE_NONE` on `vertical` only when `is_fixed`
 * is true, and `is_fixed` is set true only inside HBoxContainer's and
 * VBoxContainer's own constructors (box_container.h) — a plain `BoxContainer`
 * keeps the header's `is_fixed = false` default, so on this type `vertical`
 * stays serialisable and gets a validator here.
 */

import '../../../2d/ui/control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { CONTAINER_ALIGNMENT } from '../../../../linter/validators/containerAlignment.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('BoxContainer', {
  // box_container.cpp:379 — ADD_PROPERTY PROPERTY_HINT_ENUM "Begin,Center,End",
  // matching BIND_ENUM_CONSTANT ALIGNMENT_BEGIN=0, ALIGNMENT_CENTER=1,
  // ALIGNMENT_END=2. set_alignment (box_container.cpp:299-305) assigns
  // unconditionally, no ERR_FAIL.
  alignment: v.enumInt('alignment', 0, 2, CONTAINER_ALIGNMENT, { hinted: 'box_container.cpp:379' }),
  // box_container.cpp _bind_methods: ADD_PROPERTY(PropertyInfo(Variant::BOOL,
  // "vertical"), ...). See the file header for why this reaches a plain
  // BoxContainer instance at all.
  vertical: v.boolean('vertical'),
});
