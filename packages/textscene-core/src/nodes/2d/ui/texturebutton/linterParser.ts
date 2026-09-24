/**
 * TextureButton strict validators: all ten members doc/classes/TextureButton.xml lists, none with
 * `overrides=`. texture_button.h declares no `_set`/`_get`/`_get_property_list`/`_validate_property`,
 * so no key exists beyond the `ADD_PROPERTY` calls, and no setter refuses a write outright.
 */

import '../basebutton/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';import { TEXTURE_STRETCH_MODE } from '../../../../linter/validators/sharedEnumLabels.js';

import { v } from '../../../../linter/validators/index.js';

// texture_button.h:39-47: enum StretchMode, 7 values, bound at texture_button.cpp:286-292.
// The labels come from the ADD_PROPERTY hint string at texture_button.cpp:282.

validatorRegistry.registerAll('TextureButton', {
  // texture_button.cpp:396-403: set_flip_h assigns straight through. ADD_PROPERTY at :283
  // carries PROPERTY_HINT_RESOURCE_TYPE, a leftover on a BOOL, not a range. Format-only.
  flip_h: v.boolean('flip_h'),
  // texture_button.cpp:409-416: set_flip_v, the same shape as flip_h. ADD_PROPERTY
  // at :284. Format-only.
  flip_v: v.boolean('flip_v'),
  // texture_button.cpp:373-381: set_ignore_texture_size assigns straight
  // through. ADD_PROPERTY at :281. Format-only.
  ignore_texture_size: v.boolean('ignore_texture_size'),
  // texture_button.cpp:383-390: set_stretch_mode has no ERR_FAIL_INDEX, unlike
  // TextureProgressBar's set_fill_mode. The 7-label PROPERTY_HINT_ENUM at :282 only
  // hints the range, so out of range warns.
  stretch_mode: v.enumInt('stretch_mode', 0, 6, TEXTURE_STRETCH_MODE, { hinted: 'texture_button.cpp:282' }),
  // texture_button.cpp:311-317: set_click_mask assigns straight through. ADD_PROPERTY
  // at :280 is PROPERTY_HINT_RESOURCE_TYPE "BitMap", which restricts the editor's
  // resource picker, not the engine. Format-only.
  texture_click_mask: v.resourceReference('texture_click_mask'),
  // texture_button.cpp:307-309: set_texture_disabled delegates to `_set_texture`
  // (texture_button.cpp:347-362), which assigns with no type check. ADD_PROPERTY at
  // :278 is PROPERTY_HINT_RESOURCE_TYPE "Texture2D", editor-picker only. Format-only.
  texture_disabled: v.resourceReference('texture_disabled'),
  // texture_button.cpp:343-345: set_texture_focused delegates to
  // `_set_texture` the same way. ADD_PROPERTY at :279. Format-only.
  texture_focused: v.resourceReference('texture_focused'),
  // texture_button.cpp:303-305: set_texture_hover delegates to `_set_texture`.
  // ADD_PROPERTY at :277. Format-only.
  texture_hover: v.resourceReference('texture_hover'),
  // texture_button.cpp:295-297: set_texture_normal delegates to
  // `_set_texture`. ADD_PROPERTY at :275. Format-only.
  texture_normal: v.resourceReference('texture_normal'),
  // texture_button.cpp:299-301: set_texture_pressed delegates to
  // `_set_texture`. ADD_PROPERTY at :276. Format-only.
  texture_pressed: v.resourceReference('texture_pressed'),
});
