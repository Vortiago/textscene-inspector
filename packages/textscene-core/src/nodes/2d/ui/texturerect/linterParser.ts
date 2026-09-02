/**
 * TextureRect strict validators for linting.
 *
 * Declare only TextureRect's OWN members: the ones doc/classes/TextureRect.xml
 * lists without an `overrides=` attribute. Everything from Control up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 * `mouse_filter` carries `overrides="Control"` (only its default changes, to
 * MOUSE_FILTER_PASS, set in the constructor) so it is skipped here; the other
 * five own members below all lack `overrides=` and get a validator.
 *
 * The deprecated `_set` override (texture_rect.cpp:171-173) forwards the
 * Godot-3 keys `expand` and `ignore_texture_size` to `expand_mode =
 * EXPAND_IGNORE_SIZE` when `bool(p_value)` holds and drops them otherwise;
 * `godot/deprecated.ts` resolves both in the property bag, so the parser reads
 * the result under `expand_mode`. Neither key gets a validator: the arm takes
 * any Variant and refuses nothing, so there is no bound to report.
 *
 * `texture_rect.h` declares no `_get`/`_get_property_list`, so there are no
 * other dynamic/hidden-but-serialised keys beyond the five `ADD_PROPERTY`
 * calls in `_bind_methods`.
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';import { TEXTURE_STRETCH_MODE } from '../../../../linter/validators/sharedEnumLabels.js';

import { v } from '../../../../linter/validators/index.js';

// texture_rect.h:39-46: enum ExpandMode, 6 values; BIND_ENUM_CONSTANT at
// texture_rect.cpp:153-158. Labels from the ADD_PROPERTY hint string at
// texture_rect.cpp:148.
const EXPAND_MODE = {
  0: 'EXPAND_KEEP_SIZE',
  1: 'EXPAND_IGNORE_SIZE',
  2: 'EXPAND_FIT_WIDTH',
  3: 'EXPAND_FIT_WIDTH_PROPORTIONAL',
  4: 'EXPAND_FIT_HEIGHT',
  5: 'EXPAND_FIT_HEIGHT_PROPORTIONAL',
};

// texture_rect.h:48-56: enum StretchMode, 7 values; BIND_ENUM_CONSTANT at
// texture_rect.cpp:160-166. Labels from the ADD_PROPERTY hint string at
// texture_rect.cpp:149.

validatorRegistry.registerAll('TextureRect', {
  // texture_rect.cpp:207-215: set_expand_mode assigns straight through with no
  // ERR_FAIL_INDEX (only an early-return on a redundant set), unlike
  // TextureProgressBar's set_fill_mode. ADD_PROPERTY at :148 carries
  // PROPERTY_HINT_ENUM with 6 labels, so out-of-range is only HINTED, not
  // enforced: a warning, not an error.
  expand_mode: v.enumInt('expand_mode', 0, 5, EXPAND_MODE, { hinted: 'texture_rect.cpp:148' }),
  // texture_rect.cpp:234-241: set_flip_h assigns straight through (only an
  // early-return on a redundant set); ADD_PROPERTY at :150 carries no hint.
  // Format-only.
  flip_h: v.boolean('flip_h'),
  // texture_rect.cpp:247-254: set_flip_v, same shape as flip_h; ADD_PROPERTY
  // at :151. Format-only.
  flip_v: v.boolean('flip_v'),
  // texture_rect.cpp:221-228: set_stretch_mode assigns straight through with
  // no ERR_FAIL_INDEX (only an early-return on a redundant set), the same
  // shape as TextureButton's stretch_mode. ADD_PROPERTY at :149 carries
  // PROPERTY_HINT_ENUM with 7 labels, so out-of-range is only HINTED, not
  // enforced: a warning, not an error.
  stretch_mode: v.enumInt('stretch_mode', 0, 6, TEXTURE_STRETCH_MODE, { hinted: 'texture_rect.cpp:149' }),
  // texture_rect.cpp:184-201: set_texture assigns straight through (only an
  // early-return on a redundant set); ADD_PROPERTY at :147 is
  // PROPERTY_HINT_RESOURCE_TYPE "Texture2D", editor-picker only. Format-only.
  texture: v.resourceReference('texture'),
});
