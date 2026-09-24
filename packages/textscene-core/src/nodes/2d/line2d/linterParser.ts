/**
 * Line2D strict validators for linting: the point array, the stroke geometry, and
 * the gradient, texture and curve resource slots.
 */

// The base chain: registration happens on import, so a test that loads only this
// slice resolves an inherited key only through this line.
import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('Line2D', {
  // line_2d.cpp:394 (PACKED_VECTOR2_ARRAY, no hint). get_points
  // (line_2d.cpp:122-124) returns `Vector<Vector2>`, not a TypedArray, so Godot
  // writes only `PackedVector2Array(...)`. set_points (line_2d.cpp:78-81) is a bare
  // assignment: format-only.
  points: v.packedVector2Array('points'),
  // line_2d.cpp:93 clamps a negative width up to 0, an alteration. The end is the
  // setter's: line_2d.cpp:396 declares PROPERTY_HINT_NONE.
  width: v.float('width', { enforcedMin: { at: 0 }, enforced: { min: 'line_2d.cpp:93' } }),
  // line_2d.cpp:397, OBJECT + RESOURCE_TYPE "Curve" (property name
  // "width_curve", methods set_curve/get_curve, line_2d.cpp:104-116). Bare
  // assignment past a changed-signal (re)connect, no value check: format-only.
  // Godot omits the key entirely when the slot is cleared.
  width_curve: v.resourceReference('width_curve'),
  default_color: v.color('default_color'),
  // line_2d.cpp:400, OBJECT + RESOURCE_TYPE "Gradient". set_gradient
  // (line_2d.cpp:172-183) bare-assigns past a changed-signal (re)connect:
  // format-only.
  gradient: v.resourceReference('gradient'),
  // line_2d.cpp:401, OBJECT + RESOURCE_TYPE "Texture2D". set_texture
  // (line_2d.cpp:190-193) is a bare assignment: format-only.
  texture: v.resourceReference('texture'),
  // line_2d.cpp:402, ENUM "None,Tile,Stretch" (LineTextureMode: NONE 0, TILE 1,
  // STRETCH 2, line_2d.h:52-55, 3 BIND_ENUM_CONSTANTs match the 3 labels).
  // set_texture_mode (line_2d.cpp:199-202) assigns unconditionally: hinted,
  // not enforced (ADR-0032).
  texture_mode: v.enumInt(
    'texture_mode',
    0,
    2,
    { 0: 'NONE', 1: 'TILE', 2: 'STRETCH' },
    { hinted: 'line_2d.cpp:402' }
  ),
  closed: v.boolean('closed'),
  // line_2d.cpp:404, ENUM "Sharp,Bevel,Round" (LineJointMode: SHARP 0, BEVEL 1,
  // ROUND 2, no MAX sentinel, but 3 real values match the 3 labels).
  // set_joint_mode (line_2d.cpp:208-211) assigns unconditionally, no
  // ERR_FAIL_INDEX, so out of range is a warning (ADR-0032).
  joint_mode: v.enumInt(
    'joint_mode',
    0,
    2,
    { 0: 'SHARP', 1: 'BEVEL', 2: 'ROUND' },
    { hinted: 'line_2d.cpp:404' }
  ),
  // line_2d.cpp:405, ENUM "None,Box,Round" (LineCapMode: NONE 0, BOX 1, ROUND
  // 2, line_2d.h:46-49, 3 constants match the 3 labels). set_begin_cap_mode
  // (line_2d.cpp:217-220) assigns unconditionally: hinted, not enforced.
  begin_cap_mode: v.enumInt(
    'begin_cap_mode',
    0,
    2,
    { 0: 'NONE', 1: 'BOX', 2: 'ROUND' },
    { hinted: 'line_2d.cpp:405' }
  ),
  // line_2d.cpp:406, same enum and shape as begin_cap_mode. set_end_cap_mode
  // (line_2d.cpp:226-229) assigns unconditionally: hinted, not enforced.
  end_cap_mode: v.enumInt(
    'end_cap_mode',
    0,
    2,
    { 0: 'NONE', 1: 'BOX', 2: 'ROUND' },
    { hinted: 'line_2d.cpp:406' }
  ),
  // line_2d.cpp:408 carries no hint. set_sharp_limit (line_2d.cpp:243-249) clamps a
  // negative value to 0 (`if (p_limit < 0.f) p_limit = 0.f;`), a silent correction
  // ADR-0032 treats as enforced. The same clamp shape as `width`, and
  // line_2d.cpp:408 declares no hint either.
  sharp_limit: v.float('sharp_limit', {
    enforcedMin: { at: 0 },
    enforced: { min: 'line_2d.cpp:244' },
  }),
  // line_2d.cpp:409 hints "1,32,1", hard both ends. set_round_precision clamps
  // below 1 (`_round_precision = MAX(1, p_precision);`, line_2d.cpp:256), enforcing
  // the floor. The setter never enforces the 32 ceiling, so it warns.
  round_precision: v.strictInt('round_precision', {
    min: 1,
    max: 32,
    enforced: { min: 'line_2d.cpp:256' },
    hinted: { max: 'line_2d.cpp:409' },
  }),
  // line_2d.cpp:410, BOOL, no hint. set_antialiased (line_2d.cpp:264-267) is a
  // bare assignment: format-only.
  antialiased: v.boolean('antialiased'),
});
