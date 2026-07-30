/**
 * The wildcard validators for Godot's `theme_override_<kind>` property family.
 *
 * Godot emits it from `Theme::DATA_TYPE_` constants in exactly two places —
 * `Control::_get_property_list` (scene/gui/control.cpp) and
 * `Window::_get_property_list` (scene/main/window.cpp) — with identical types
 * and identical range hints. Two owners is enough for the pair to drift: the
 * bounds below were wrong on Control (font sizes allowed 0 where Godot's hint
 * starts at 1, constants carried no range at all, and icons were missing
 * entirely), and a second hand-written copy would have to be corrected twice.
 *
 * The two bounded hints, quoted so the numbers below are checkable:
 *   constants   PROPERTY_HINT_RANGE "-16384,16384"       — both bounds hard
 *   font sizes  PROPERTY_HINT_RANGE "1,256,1,or_greater" — min hard, max soft
 */

import { v } from './v.js';
import type { PropertyValidator } from '../ValidatorRegistry.js';

export const THEME_OVERRIDE_VALIDATORS: Readonly<Record<string, PropertyValidator>> = {
  'theme_override_colors/*': v.color('theme_override_colors'),
  'theme_override_constants/*': v.int('theme_override_constants', { min: -16384, max: 16384 }),
  'theme_override_fonts/*': v.resourceReference('theme_override_fonts'),
  // `or_greater` makes 256 an editor convenience, not a limit — so no max.
  'theme_override_font_sizes/*': v.int('theme_override_font_sizes', { min: 1 }),
  'theme_override_icons/*': v.resourceReference('theme_override_icons'),
  'theme_override_styles/*': v.resourceReference('theme_override_styles'),
};
