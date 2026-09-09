/**
 * ColorRect strict validators for linting.
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('ColorRect', {
  // color_rect.cpp:65, ADD_PROPERTY(PropertyInfo(Variant::COLOR, "color"), ...)
  // carries no PROPERTY_HINT at all. set_color (color_rect.cpp:33-40) only
  // short-circuits on an unchanged value; any other Color is assigned straight
  // through, no clamp, no ERR_FAIL. PROPERTY_HINT_NONE means no numeric bound
  // exists to ground a diagnostic on (ADR-0032 "nothing"), so this is a format
  // check only: an HDR component outside 0-1 is exactly as legal here as
  // everywhere else in Godot.
  color: v.color('color'),
});
