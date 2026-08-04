/**
 * SubViewportContainer strict validators — format only, so every failure is an
 * error. Control's own anchor/offset/layout validators reach this type through
 * the base-type chain (`linter/nodeBaseTypes.ts`), not from here.
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('SubViewportContainer', {
  stretch: v.boolean('stretch'),
  // subviewport_container.cpp:71 — `ERR_FAIL_COND(p_shrink < 1)` — below 1 is
  // objectively invalid, not merely suspicious, so it is an error rather than
  // an advisory.
  stretch_shrink: v.positiveInt(
    'stretch_shrink',
    "Property 'stretch_shrink' must be an integer >= 1 (Godot rejects anything lower)",
    { enforced: 'subviewport_container.cpp:71' }
  ),
});
