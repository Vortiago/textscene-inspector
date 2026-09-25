/**
 * CanvasGroup strict validators for linting: only its own members, the ones
 * doc/classes/CanvasGroup.xml lists without `overrides=`. The NODE_BASE_TYPES
 * base-walk delivers Node2D's, and a re-declared inherited key would shadow it.
 */

import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('CanvasGroup', {
  // canvas_group.cpp:34 `ERR_FAIL_COND(p_fit_margin < 0.0)` refuses a negative
  // value, the hint's own floor (canvas_group.cpp:110, "0,1024,…"): an error.
  // `,or_greater` opens the ceiling, so nothing above 1024 warns.
  fit_margin: v.nonNegativeFloat('fit_margin', { enforced: 'canvas_group.cpp:34' }),
  // canvas_group.cpp:47, same shape as fit_margin.
  clear_margin: v.nonNegativeFloat('clear_margin', { enforced: 'canvas_group.cpp:47' }),
  // canvas_group.cpp:112: plain BOOL, no hint.
  use_mipmaps: v.boolean('use_mipmaps'),
});
