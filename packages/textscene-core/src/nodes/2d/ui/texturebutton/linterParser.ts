/**
 * TextureButton strict validators for linting.
 *
 * Declare only TextureButton's OWN members: the ones doc/classes/TextureButton.xml
 * lists without an `overrides=` attribute. Everything from BaseButton up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule. None of
 * TextureButton's own 10 members carries `overrides=`, unlike TextureProgressBar's
 * `mouse_filter`/`size_flags_vertical`/`step`; every one below is genuinely its
 * own.
 *
 * TextureButton descends straight from BaseButton, not Button, so it has no
 * `text`/`alignment`/`icon`: its whole visual state is five texture slots (each
 * an independent `Ref<Texture2D>` assigned through the same private
 * `_set_texture` helper), a click mask, a stretch mode and two flip flags.
 *
 * `texture_button.h` declares only `get_minimum_size`, `has_point`,
 * `_notification` and `_bind_methods`: no `_set`/`_get`/`_get_property_list`
 * and no `_validate_property`, so there are no dynamic/hidden-but-serialised
 * keys beyond the 10 `ADD_PROPERTY` calls in `_bind_methods`, and no setter
 * refuses a write outright, so `registerUnavailable` does not apply anywhere
 * here.
 */

import '../basebutton/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';import { TEXTURE_STRETCH_MODE } from '../../../../linter/validators/sharedEnumLabels.js';

import { v } from '../../../../linter/validators/index.js';

// texture_button.h:39-47: enum StretchMode, 7 values; BIND_ENUM_CONSTANT at
// texture_button.cpp:286-292. Labels from the ADD_PROPERTY hint string at
// texture_button.cpp:282.

validatorRegistry.registerAll('TextureButton', {
  // texture_button.cpp:396-403: set_flip_h assigns straight through (only an
  // early-return on a redundant set); ADD_PROPERTY at :283 carries
  // PROPERTY_HINT_RESOURCE_TYPE (a leftover on a BOOL, not a range). Format-only.
  flip_h: v.boolean('flip_h'),
  // texture_button.cpp:409-416: set_flip_v, same shape as flip_h; ADD_PROPERTY
  // at :284. Format-only.
  flip_v: v.boolean('flip_v'),
  // texture_button.cpp:373-381: set_ignore_texture_size assigns straight
  // through; ADD_PROPERTY at :281. Format-only.
  ignore_texture_size: v.boolean('ignore_texture_size'),
  // texture_button.cpp:383-390: set_stretch_mode assigns straight through with
  // no ERR_FAIL_INDEX (only an early-return on a redundant set), unlike
  // TextureProgressBar's set_fill_mode. ADD_PROPERTY at :282 carries
  // PROPERTY_HINT_ENUM with 7 labels, so out-of-range is only HINTED, not
  // enforced: a warning, not an error.
  stretch_mode: v.enumInt('stretch_mode', 0, 6, TEXTURE_STRETCH_MODE, { hinted: 'texture_button.cpp:282' }),
  // texture_button.cpp:311-317: set_click_mask assigns straight through (only
  // an early-return on a redundant set); ADD_PROPERTY at :280 is
  // PROPERTY_HINT_RESOURCE_TYPE "BitMap", which restricts the editor's resource
  // picker, not the engine. Format-only.
  texture_click_mask: v.resourceReference('texture_click_mask'),
  // texture_button.cpp:307-309: set_texture_disabled delegates to the shared
  // `_set_texture` (texture_button.cpp:347-362), which assigns straight through
  // with no type check of its own; ADD_PROPERTY at :278 is
  // PROPERTY_HINT_RESOURCE_TYPE "Texture2D", editor-picker only. Format-only.
  texture_disabled: v.resourceReference('texture_disabled'),
  // texture_button.cpp:343-345: set_texture_focused delegates to
  // `_set_texture` the same way; ADD_PROPERTY at :279. Format-only.
  texture_focused: v.resourceReference('texture_focused'),
  // texture_button.cpp:303-305: set_texture_hover delegates to `_set_texture`;
  // ADD_PROPERTY at :277. Format-only.
  texture_hover: v.resourceReference('texture_hover'),
  // texture_button.cpp:295-297: set_texture_normal delegates to
  // `_set_texture`; ADD_PROPERTY at :275. Format-only.
  texture_normal: v.resourceReference('texture_normal'),
  // texture_button.cpp:299-301: set_texture_pressed delegates to
  // `_set_texture`; ADD_PROPERTY at :276. Format-only.
  texture_pressed: v.resourceReference('texture_pressed'),
});
