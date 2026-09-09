/**
 * ReferenceRect strict validators for linting.
 *
 * Declare only ReferenceRect's OWN members: the ones doc/classes/ReferenceRect.xml
 * lists without an `overrides=` attribute. Everything from Control up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * All three of ReferenceRect's own ADD_PROPERTY calls (reference_rect.cpp:98-100)
 * omit the usage argument, so all three carry the constructor default
 * PROPERTY_USAGE_DEFAULT = STORAGE | EDITOR (object.h:131) rather than
 * PROPERTY_USAGE_NONE or the narrower PROPERTY_USAGE_NO_EDITOR (object.h:132).
 * That includes `editor_only`: it is not editor-hint-only plumbing, it
 * serialises into every `.tscn` like any other member, so it gets a validator
 * like the other two. ReferenceRect overrides neither `_validate_property` nor
 * `_get_property_list` (reference_rect.h has no such declarations), so nothing
 * narrows this at runtime either.
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('ReferenceRect', {
  // reference_rect.cpp:98, PROPERTY_HINT_NONE (no hint argument at all). The
  // setter (reference_rect.cpp:48-55) assigns straight through with no clamp,
  // so a Color component outside 0-1 is legal HDR, not a bound to enforce.
  border_color: v.color('border_color'),
  // reference_rect.cpp:99 hints PROPERTY_HINT_RANGE "0.0,5.0,0.1,or_greater,…":
  // the `or_greater` flag opens the max end, so 5.0 is not a ceiling at all.
  // The floor is real: set_border_width (reference_rect.cpp:61-69) computes
  // `MAX(0.0, p_width)` and stores THAT, silently altering a negative write
  // rather than merely flagging it in the inspector, so it is an ERROR per
  // ADR-0032, grounded in the clamp itself rather than in the matching hint.
  border_width: v.nonNegativeFloat('border_width', { enforced: 'reference_rect.cpp:62' }),
  // reference_rect.cpp:100, PROPERTY_HINT_NONE. set_editor_only
  // (reference_rect.cpp:75-82) assigns straight through with no guard, so this
  // is a format check only.
  editor_only: v.boolean('editor_only'),
});
