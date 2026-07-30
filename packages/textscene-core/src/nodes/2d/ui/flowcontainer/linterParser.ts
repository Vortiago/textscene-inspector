/**
 * FlowContainer strict validators for linting.
 *
 * Declare only FlowContainer's OWN members — the ones doc/classes/FlowContainer.xml
 * lists without an `overrides=` attribute. Everything from Control up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * `vertical` is included here even though `HFlowContainer`/`VFlowContainer` hide
 * it: `_validate_property` (flow_container.cpp:333-336) only sets
 * `PROPERTY_USAGE_NONE` on it `if (is_fixed && ...)`, and `is_fixed` is a
 * protected field the base `FlowContainer` constructor leaves `false`
 * (flow_container.h:69, flow_container.cpp:394-396) — only the `HFlowContainer`
 * / `VFlowContainer` constructors set it `true` (flow_container.h:104,112). So a
 * plain `FlowContainer` node still serialises `vertical` to the `.tscn`; the
 * leaf subclasses (a later wave) are the ones that skip it.
 */

import '../../../2d/ui/control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('FlowContainer', {
  // flow_container.cpp:418 — PROPERTY_HINT_ENUM "Begin,Center,End";
  // BIND_ENUM_CONSTANT ALIGNMENT_BEGIN=0, ALIGNMENT_CENTER=1, ALIGNMENT_END=2
  // (flow_container.cpp:410-412). Default 0 (doc/classes/FlowContainer.xml).
  alignment: v.enumInt('alignment', 0, 2, {
    0: 'ALIGNMENT_BEGIN',
    1: 'ALIGNMENT_CENTER',
    2: 'ALIGNMENT_END',
  }),
  // flow_container.cpp:419 — PROPERTY_HINT_ENUM "Inherit,Begin,Center,End";
  // BIND_ENUM_CONSTANT LAST_WRAP_ALIGNMENT_INHERIT=0, _BEGIN=1, _CENTER=2, _END=3
  // (flow_container.cpp:413-416). Default 0 (doc/classes/FlowContainer.xml).
  last_wrap_alignment: v.enumInt('last_wrap_alignment', 0, 3, {
    0: 'LAST_WRAP_ALIGNMENT_INHERIT',
    1: 'LAST_WRAP_ALIGNMENT_BEGIN',
    2: 'LAST_WRAP_ALIGNMENT_CENTER',
    3: 'LAST_WRAP_ALIGNMENT_END',
  }),
  // flow_container.cpp:420 — always serialised on a plain FlowContainer; see
  // the file-level comment above for why the leaf subclasses' hiding of this
  // property does not apply here.
  vertical: v.boolean('vertical'),
  // flow_container.cpp:421
  reverse_fill: v.boolean('reverse_fill'),
});
