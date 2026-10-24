/**
 * Strict validation for TextMesh's own properties, through the `v` combinators. `flip_faces`,
 * `material`, `custom_aabb`, `add_uv2` and `uv2_padding` are `PrimitiveMesh`'s, and the base-walk
 * delivers them to this class. Each cite is a line of `scene/resources/3d/primitive_meshes.cpp`.
 */

// Registers PrimitiveMesh and, through it, the rest of the chain, so the
// inherited keys resolve when this module loads alone.
import '../primitivemesh/linterValidators.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { hintedBitField, v } from '../../../linter/validators/index.js';
import {
  HORIZONTAL_ALIGNMENT_NAMES,
  VERTICAL_ALIGNMENT_BOTTOM,
  VERTICAL_ALIGNMENT_NAMES,
  VERTICAL_ALIGNMENT_TOP,
} from '../../../godot/math/alignment.js';
import {
  AUTOWRAP_MODE_NAMES,
  JUSTIFICATION_HINTED_NAMES,
  STRUCTURED_TEXT_PARSER_NAMES,
  TEXT_DIRECTION_NAMES,
  TextDirection,
} from '../../../godot/text/textServerEnums.js';

validatorRegistry.registerAll('TextMesh', {
  text: v.quotedString('text'),
  // :3664, PROPERTY_HINT_RESOURCE_TYPE "Font". `set_font` (:3758) reassigns, so this is format-only.
  font: v.resourceReference('font'),
  // :3665 hints "1,256,1,or_greater", so the top is open, while `set_font_size` (:3813) clamps to 1 to
  // 127: 0 and 128 and up are altered.
  font_size: v.int('font_size', { min: 1, enforcedMax: { at: 127 }, enforced: 'primitive_meshes.cpp:3813' }),
  // `set_horizontal_alignment` (:3713) is ERR_FAIL_INDEX((int)p_alignment, 4): the setter refuses.
  horizontal_alignment: v.enumInt('horizontal_alignment', HORIZONTAL_ALIGNMENT_NAMES, {
    enforced: 'primitive_meshes.cpp:3713',
  }),
  // Two tiers: :3667 hints "Top,Center,Bottom" and `set_vertical_alignment` (:3728) refuses only at
  // ERR_FAIL_INDEX((int)p_alignment, 4), so FILL loads and warns while 4 and up error.
  vertical_alignment: v.enumInt(
    'vertical_alignment',
    VERTICAL_ALIGNMENT_TOP,
    VERTICAL_ALIGNMENT_BOTTOM,
    VERTICAL_ALIGNMENT_NAMES,
    { hinted: 'primitive_meshes.cpp:3667', enforced: 'primitive_meshes.cpp:3728', enforcedMax: { at: 3 } }
  ),
  uppercase: v.boolean('uppercase'),
  // :3669 hints only "suffix:px", and a negative spacing is legal, so no bound.
  line_spacing: v.float('line_spacing'),
  // :3670 hints the four AutowrapMode values and `set_autowrap_mode` (:3835) assigns them all.
  autowrap_mode: v.enumInt('autowrap_mode', AUTOWRAP_MODE_NAMES, { hinted: 'primitive_meshes.cpp:3670' }),
  // :3671 hints six of the eight JustificationFlag bits. `set_justification_flags` (:3847) keeps the
  // other two, which the inspector cannot set, so they warn.
  justification_flags: hintedBitField('justification_flags', {
    hinted: 'primitive_meshes.cpp:3671',
    labels: JUSTIFICATION_HINTED_NAMES,
  }),
  // :3674 hints "0.0001,128,0.0001" and `set_pixel_size` (:3884) clamps to it.
  pixel_size: v.float('pixel_size', { min: 0.0001, max: 128, enforced: 'primitive_meshes.cpp:3884' }),
  // :3675 hints "0.1,10,0.1" and `set_curve_step` (:3907) clamps to it.
  curve_step: v.float('curve_step', { min: 0.1, max: 10, enforced: 'primitive_meshes.cpp:3907' }),
  // :3676 hints "0.0,100.0,0.001,or_greater", so the top is open. `set_depth` (:3861) raises a negative to 0.
  depth: v.float('depth', { min: 0, enforced: 'primitive_meshes.cpp:3861' }),
  // :3677 hints only "suffix:px", and `set_width` (:3870) assigns it.
  width: v.float('width'),
  // :3678 hints only "suffix:px", and `set_offset` (:3894) assigns it.
  offset: v.vector2('offset'),
  // `set_text_direction` (:3918) is ERR_FAIL_COND((int)p_text_direction < -1 || > 3). -1 is a legacy
  // spelling with no named constant, so it is legal but unlabelled.
  text_direction: v.enumInt(
    'text_direction',
    TextDirection.TEXT_DIRECTION_AUTO,
    TextDirection.TEXT_DIRECTION_RTL,
    TEXT_DIRECTION_NAMES,
    {
      hinted: 'primitive_meshes.cpp:3681',
      enforced: 'primitive_meshes.cpp:3918',
      enforcedMin: { at: -1 },
      enforcedMax: { at: 3 },
    }
  ),
  // :3682, PROPERTY_HINT_LOCALE_ID with no hint string. `set_language` (:3930) assigns any string.
  language: v.quotedString('language'),
  // :3683 hints the seven StructuredTextParser values and `set_structured_text_bidi_override` (:3942) assigns them.
  structured_text_bidi_override: v.enumInt('structured_text_bidi_override', STRUCTURED_TEXT_PARSER_NAMES, {
    hinted: 'primitive_meshes.cpp:3683',
  }),
  // :3684 declares an untyped Array and `set_structured_text_bidi_override_options` (:3954) assigns it,
  // so only a malformed literal is refused.
  structured_text_bidi_override_options: v.arrayLiteral('structured_text_bidi_override_options'),
});
