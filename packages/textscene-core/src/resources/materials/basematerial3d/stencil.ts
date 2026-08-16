/**
 * BaseMaterial3D's Stencil group (`material.cpp:3774-3781`).
 *
 * `stencil_flags` is both tiers, for two reasons:
 *
 * - Read and write are mutually exclusive. `set_stencil_flags` reduces a value
 *   asking for both to READ alone (:3267), and that branch tests the incoming
 *   value against itself, so a freshly loaded material takes it too. An altered
 *   write is the error tier.
 * - A bit outside the three the hint lists is KEPT — the setter bare-assigns
 *   what survives, with no `& MASK`. Stored but unreachable from the inspector,
 *   which is `hintedBitField`'s warning.
 */

import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';
import { v, hintedBitField } from '../../../linter/validators/index.js';
import { propertyError } from '../../../linter/validators/propertyError.js';
import { parseGodotInt } from '../../../linter/validators/commonValidators.js';

/** material.h:340-342. */
const STENCIL_FLAG_READ = 1;
const STENCIL_FLAG_WRITE = 2;
const STENCIL_FLAG_WRITE_DEPTH_FAIL = 4;
const STENCIL_WRITE_FLAGS = STENCIL_FLAG_WRITE | STENCIL_FLAG_WRITE_DEPTH_FAIL;

function stencilFlags(): PropertyValidator {
  const listed = hintedBitField('stencil_flags', {
    hinted: 'material.cpp:3776',
    labels: {
      [STENCIL_FLAG_READ]: 'READ',
      [STENCIL_FLAG_WRITE]: 'WRITE',
      [STENCIL_FLAG_WRITE_DEPTH_FAIL]: 'WRITE_DEPTH_FAIL',
    },
  });

  const validator: PropertyValidator = (key, value, line) => {
    const unlisted = listed(key, value, line);
    // A malformed literal is the one thing that stops the exclusivity check
    // from having a number to read.
    if (unlisted?.severity === 'error') return unlisted;
    // `listed` errors on anything unreadable OR unstorable, so a usable number
    // is the only thing that reaches here.
    const bits = parseGodotInt(value);
    if (bits === null || Number.isNaN(bits)) return null;
    if ((bits & STENCIL_FLAG_READ) !== 0 && (bits & STENCIL_WRITE_FLAGS) !== 0) {
      return propertyError(
        key,
        line,
        `Property 'stencil_flags' cannot READ and WRITE at once; Godot keeps only READ, so this stores ${STENCIL_FLAG_READ} rather than ${bits}`,
        'INVALID_STENCIL_FLAGS_VALUE'
      );
    }
    return unlisted;
  };
  validator.accepts = listed.accepts;
  // Forwarded with `accepts`: this wrapper reads the same INT slot, and a tag
  // dropped here takes the property out of the int-slot sweep entirely.
  validator.intSlot = listed.intSlot;
  // Both lines, the same way `ground` records a two-ended bound: the rewrite is
  // the stronger claim and the hint is what the warning arm rests on.
  validator.grounding = { kind: 'enforced', cite: 'material.cpp:3267, material.cpp:3776' };
  return validator;
}

export const stencilKeys: Record<string, PropertyValidator> = {
  stencil_mode: v.enumInt(
    'stencil_mode',
    0,
    3,
    { 0: 'DISABLED', 1: 'OUTLINE', 2: 'XRAY', 3: 'CUSTOM' },
    { hinted: 'material.cpp:3775' }
  ),
  stencil_flags: stencilFlags(),
  stencil_compare: v.enumInt(
    'stencil_compare',
    0,
    6,
    {
      0: 'ALWAYS',
      1: 'LESS',
      2: 'EQUAL',
      3: 'LESS_OR_EQUAL',
      4: 'GREATER',
      5: 'NOT_EQUAL',
      6: 'GREATER_OR_EQUAL',
    },
    { hinted: 'material.cpp:3777' }
  ),
  // material.cpp:3778 ("0,255,1"); set_stencil_reference (:3292) bare assigns.
  stencil_reference: v.int('stencil_reference', {
    min: 0,
    max: 255,
    hinted: 'material.cpp:3778',
  }),
  stencil_color: v.color('stencil_color'),
  // material.cpp:3781 ("0,1,0.001,or_greater,suffix:m"); set_stencil_effect_outline_thickness
  // (:3327) bare assigns, and `or_greater` opens the ceiling.
  stencil_outline_thickness: v.nonNegativeFloat('stencil_outline_thickness', {
    hinted: 'material.cpp:3781',
  }),
};
