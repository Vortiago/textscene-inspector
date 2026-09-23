/** ColorRect strict validators. */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('ColorRect', {
  // color_rect.cpp:65 declares no hint, and set_color (color_rect.cpp:33-40) assigns
  // any Color with no clamp or ERR_FAIL. That is the "nothing" tier of ADR-0032, so
  // this checks the format only, and an HDR component is legal.
  color: v.color('color'),
});
