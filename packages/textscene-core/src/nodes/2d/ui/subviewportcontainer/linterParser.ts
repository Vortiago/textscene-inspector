/**
 * SubViewportContainer strict validators — format only, so every failure is an
 * error. Control's own anchor/offset/layout validators reach this type through
 * the base-type chain (`godot/nodeBaseTypes.ts`), not from here.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../control/linterParser.js';
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
  // subviewport_container.cpp:249-251 — bare assignment, no hint on the BOOL
  // property (:302), so format-only.
  mouse_target: v.boolean('mouse_target'),
});
