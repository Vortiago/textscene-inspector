/**
 * Line2D strict validators for linting. Validates the Line2D-specific surface
 * (width, default_color, closed); `points` (PackedVector2Array) has no strict
 * format validator and is accepted as-is — same convention Polygon2D uses for
 * `polygon`.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('Line2D', {
  width: v.float('width'),
  default_color: v.color('default_color'),
  closed: v.boolean('closed'),
  // line_2d.cpp:404, ENUM "Sharp,Bevel,Round" (LineJointMode: SHARP 0, BEVEL 1,
  // ROUND 2; no MAX sentinel, but 3 real values match the 3 labels).
  // set_joint_mode (line_2d.cpp:208-211) assigns unconditionally, no
  // ERR_FAIL_INDEX, so out of range is a warning (ADR-0032).
  joint_mode: v.enumInt(
    'joint_mode',
    0,
    2,
    { 0: 'SHARP', 1: 'BEVEL', 2: 'ROUND' },
    { hinted: 'line_2d.cpp:404' }
  ),
  // line_2d.cpp:408 carries no hint at all; set_sharp_limit
  // (line_2d.cpp:243-249) clamps a negative value to 0 (`if (p_limit < 0.f)
  // p_limit = 0.f;`), a silent correction ADR-0032 treats as enforced.
  sharp_limit: v.float('sharp_limit', { min: 0, enforced: 'line_2d.cpp:243' }),
  // line_2d.cpp:409 hints "1,32,1" — no or_greater/or_less, hard both ends.
  // set_round_precision (line_2d.cpp:255-256) clamps below 1
  // (`_round_precision = MAX(1, p_precision);`), enforcing the floor; the 32
  // ceiling is never setter-enforced, so it is a warning. `strictInt` (not
  // `int`) because only it wires a per-end severity through.
  round_precision: v.strictInt('round_precision', {
    min: 1,
    max: 32,
    enforced: { min: 'line_2d.cpp:255' },
    hinted: { max: 'line_2d.cpp:409' },
  }),
});
