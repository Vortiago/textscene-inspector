/**
 * ReferenceRect's strict validators: the members doc/classes/ReferenceRect.xml
 * lists without `overrides=`. All three ADD_PROPERTY calls (reference_rect.cpp:98-100)
 * take PROPERTY_USAGE_DEFAULT = STORAGE | EDITOR (object.h:131), not NO_EDITOR
 * (object.h:132), and reference_rect.h narrows none, so `editor_only` serialises too.
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

// Inherited keys arrive through the NODE_BASE_TYPES base-walk. Re-declaring one
// shadows it and duplicates the rule.
validatorRegistry.registerAll('ReferenceRect', {
  // reference_rect.cpp:98, PROPERTY_HINT_NONE. The setter (reference_rect.cpp:48-55)
  // assigns straight through, so a component outside 0-1 is legal HDR.
  border_color: v.color('border_color'),
  // reference_rect.cpp:99 hints "0.0,5.0,0.1,or_greater,…", so 5.0 is no
  // ceiling. set_border_width (reference_rect.cpp:61-69) stores `MAX(0.0, p_width)`,
  // which alters a negative write: an error per ADR-0032, grounded in the clamp.
  border_width: v.nonNegativeFloat('border_width', { enforced: 'reference_rect.cpp:62' }),
  // reference_rect.cpp:100, PROPERTY_HINT_NONE. set_editor_only
  // (reference_rect.cpp:75-82) assigns straight through. Format-only.
  editor_only: v.boolean('editor_only'),
});
