/**
 * SubViewport strict validators — pure format checks, so every failure is an
 * error (CONTEXT.md's sorting principle). Enum bounds come from
 * `doc/classes/SubViewport.xml`.
 *
 * Only SubViewport's OWN members live here. The Viewport-level set is
 * registered once in `../shared/linterParser.ts` and reaches this type through
 * the base-walk, so Window inherits the same checks.
 */

import '../shared/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

const UPDATE_MODE = {
  0: 'DISABLED',
  1: 'ONCE',
  2: 'WHEN_VISIBLE',
  3: 'WHEN_PARENT_VISIBLE',
  4: 'ALWAYS',
};

const CLEAR_MODE = { 0: 'ALWAYS', 1: 'NEVER', 2: 'ONCE' };

validatorRegistry.registerAll('SubViewport', {
  // Non-negative: a negative render target is meaningless, and Godot's own
  // setter clamps. The zero case is advisory, so it lives in linter.ts.
  size: v.vector2i('size', true),
  size_2d_override: v.vector2i('size_2d_override'),
  size_2d_override_stretch: v.boolean('size_2d_override_stretch'),
  render_target_update_mode: v.enumInt('render_target_update_mode', 0, 4, UPDATE_MODE),
  render_target_clear_mode: v.enumInt('render_target_clear_mode', 0, 2, CLEAR_MODE),
});
