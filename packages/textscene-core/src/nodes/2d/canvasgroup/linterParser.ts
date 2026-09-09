/**
 * CanvasGroup strict validators for linting.
 *
 * Declare only CanvasGroup's OWN members — the ones doc/classes/CanvasGroup.xml
 * lists without an `overrides=` attribute. Everything from Node2D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('CanvasGroup', {
  // canvas_group.cpp:34 `ERR_FAIL_COND(p_fit_margin < 0.0)` refuses a negative
  // value outright, matching the hint's own floor (canvas_group.cpp:110,
  // "0,1024,…") exactly: enforced, an error. `,or_greater` opens the ceiling, so
  // nothing above 1024 warns either — there is no second end to cite.
  fit_margin: v.nonNegativeFloat('fit_margin', { enforced: 'canvas_group.cpp:34' }),
  // canvas_group.cpp:47, same shape as fit_margin.
  clear_margin: v.nonNegativeFloat('clear_margin', { enforced: 'canvas_group.cpp:47' }),
  // canvas_group.cpp:112 — plain BOOL, no hint.
  use_mipmaps: v.boolean('use_mipmaps'),
});
