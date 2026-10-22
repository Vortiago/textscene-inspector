/** Godot 4.6.3's Light2D facts a scene's properties carry. */

import { enumNamesByValue, labelEnumNames } from '../classdb/enumNames.js';

/** `Light2D::BlendMode` (`scene/2d/light_2d.h:46-50`). */
export const Light2DBlendMode = {
  ADD: 0,
  SUB: 1,
  MIX: 2,
} as const;

/** Each blend mode by its integer, spelled as its constant (`light_2d.cpp:307`). */
export const LIGHT_2D_BLEND_MODE_NAMES = enumNamesByValue(Light2DBlendMode);

/** `Light2D::ShadowFilter` (`light_2d.h:39-44`), `SHADOW_FILTER_MAX` left out as a size marker. */
export const Light2DShadowFilter = {
  NONE: 0,
  PCF5: 1,
  PCF13: 2,
} as const;

/** Each shadow filter by its integer, spelled as its constant. */
export const LIGHT_2D_SHADOW_FILTER_NAMES = enumNamesByValue(Light2DShadowFilter);

/** Each shadow filter by its integer, in the short labels the details panel prints (`light_2d.cpp:318` adds speed notes). */
export const LIGHT_2D_SHADOW_FILTER_HINT_NAMES = labelEnumNames(Light2DShadowFilter, {
  NONE: 'None',
  PCF5: 'PCF5',
  PCF13: 'PCF13',
});
