/**
 * The wildcard validators for Godot's `theme_override_<kind>` property family,
 * shared by `Control::_get_property_list` (scene/gui/control.cpp) and
 * `Window::_get_property_list` (scene/main/window.cpp), which emit identical
 * types and range hints.
 */

import { v } from './v.js';
import type { PropertyValidator } from '../ValidatorRegistry.js';

export const THEME_OVERRIDE_VALIDATORS: Readonly<Record<string, PropertyValidator>> = {
  'theme_override_colors/*': v.color('theme_override_colors'),
  // control.cpp:432: PROPERTY_HINT_RANGE "-16384,16384", identical at
  // window.cpp:183. add_theme_constant_override (control.cpp:3399-3403) is a
  // bare map assignment, so the hint is the only statement of the bound.
  'theme_override_constants/*': v.int('theme_override_constants', {
    min: -16384,
    max: 16384,
    hinted: 'control.cpp:432',
  }),
  'theme_override_fonts/*': v.resourceReference('theme_override_fonts'),
  // control.cpp:446: PROPERTY_HINT_RANGE "1,256,1,or_greater,suffix:px",
  // identical at window.cpp:207. `or_greater` opens the max, so only the floor
  // is stated. add_theme_font_size_override (control.cpp:3387-3391) is a bare
  // map assignment.
  'theme_override_font_sizes/*': v.int('theme_override_font_sizes', {
    min: 1,
    hinted: 'control.cpp:446',
  }),
  'theme_override_icons/*': v.resourceReference('theme_override_icons'),
  'theme_override_styles/*': v.resourceReference('theme_override_styles'),
};
