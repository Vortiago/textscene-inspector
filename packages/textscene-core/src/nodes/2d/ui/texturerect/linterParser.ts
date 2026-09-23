/**
 * TextureRect strict validators: the five members doc/classes/TextureRect.xml lists without
 * `overrides=`. `mouse_filter` overrides only Control's default. texture_rect.h declares no
 * `_get`/`_get_property_list`, so no key exists beyond the `ADD_PROPERTY` calls.
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';import { TEXTURE_STRETCH_MODE } from '../../../../linter/validators/sharedEnumLabels.js';

import { v } from '../../../../linter/validators/index.js';

// texture_rect.h:39-46: enum ExpandMode, 6 values, bound at texture_rect.cpp:153-158.
// The labels come from the ADD_PROPERTY hint string at texture_rect.cpp:148.
const EXPAND_MODE = {
  0: 'EXPAND_KEEP_SIZE',
  1: 'EXPAND_IGNORE_SIZE',
  2: 'EXPAND_FIT_WIDTH',
  3: 'EXPAND_FIT_WIDTH_PROPORTIONAL',
  4: 'EXPAND_FIT_HEIGHT',
  5: 'EXPAND_FIT_HEIGHT_PROPORTIONAL',
};

// texture_rect.h:48-56: enum StretchMode, 7 values, bound at texture_rect.cpp:160-166.
// The labels come from the ADD_PROPERTY hint string at texture_rect.cpp:149.

// The deprecated `_set` (texture_rect.cpp:171-173) maps Godot 3's `expand`/`ignore_texture_size`
// to EXPAND_IGNORE_SIZE when true and drops them otherwise. `godot/deprecated.ts` resolves both
// into `expand_mode`, and neither refuses anything, so neither gets a validator.
validatorRegistry.registerAll('TextureRect', {
  // texture_rect.cpp:207-215: set_expand_mode has no ERR_FAIL_INDEX, unlike
  // TextureProgressBar's set_fill_mode. The 6-label PROPERTY_HINT_ENUM at :148 only
  // hints the range, so out of range warns.
  expand_mode: v.enumInt('expand_mode', 0, 5, EXPAND_MODE, { hinted: 'texture_rect.cpp:148' }),
  // texture_rect.cpp:234-241: set_flip_h assigns straight through. ADD_PROPERTY
  // at :150 carries no hint. Format-only.
  flip_h: v.boolean('flip_h'),
  // texture_rect.cpp:247-254: set_flip_v, the same shape as flip_h. ADD_PROPERTY
  // at :151. Format-only.
  flip_v: v.boolean('flip_v'),
  // texture_rect.cpp:221-228: set_stretch_mode has no ERR_FAIL_INDEX, like TextureButton's.
  // The 7-label PROPERTY_HINT_ENUM at :149 only hints the range, so out of range warns.
  stretch_mode: v.enumInt('stretch_mode', 0, 6, TEXTURE_STRETCH_MODE, { hinted: 'texture_rect.cpp:149' }),
  // texture_rect.cpp:184-201: set_texture assigns straight through. ADD_PROPERTY at
  // :147 is PROPERTY_HINT_RESOURCE_TYPE "Texture2D", editor-picker only. Format-only.
  texture: v.resourceReference('texture'),
});
