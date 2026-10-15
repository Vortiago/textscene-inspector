/** Label3D strict validators. */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key only if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../geometryinstance3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import {
  AlphaAntiAliasing,
  ALPHA_ANTIALIASING_NAMES,
} from '../../../godot/rendering/materials/alphaAntialiasing.js';
import { AlphaCutMode, ALPHA_CUT_NAMES } from '../../../godot/rendering/materials/alphaCut.js';
import { TextureFilter, TEXTURE_FILTER_NAMES } from '../../../godot/rendering/materials/textureFilter.js';
import { hintedBitField, maskedBitField, v } from '../../../linter/validators/index.js';
import {
  HORIZONTAL_ALIGNMENT_FILL,
  HORIZONTAL_ALIGNMENT_LEFT,
  HORIZONTAL_ALIGNMENT_NAMES,
  VERTICAL_ALIGNMENT_BOTTOM,
  VERTICAL_ALIGNMENT_NAMES,
  VERTICAL_ALIGNMENT_TOP,
} from '../../../godot/math/math.js';
import { BillboardMode, SPRITE_BILLBOARD_MODE_NAMES } from '../../../godot/scene/billboard.js';
import { MATERIAL_RENDER_PRIORITY_MIN, MATERIAL_RENDER_PRIORITY_MAX } from '../../../godot/index.js';
import {
  AutowrapMode,
  AUTOWRAP_MODE_NAMES,
  BREAK_TRIM_HINTED_BITS,
  BREAK_TRIM_LABELS,
  BREAK_TRIM_MASK,
  JUSTIFICATION_HINTED_BITS,
  StructuredTextParser,
  STRUCTURED_TEXT_PARSER_NAMES,
  TextDirection,
  TEXT_DIRECTION_NAMES,
} from '../../../godot/text/textServerEnums.js';

validatorRegistry.registerAll('Label3D', {
  text: v.quotedString('text'),
  // label_3d.cpp:131 hints "0.0001,128,0.0001,suffix:m", closed at both ends.
  // set_pixel_size:956 only compares before assigning, so both ends warn.
  pixel_size: v.float('pixel_size', { min: 0.0001, max: 128, hinted: 'label_3d.cpp:131' }),
  // set_billboard_mode:1001, ERR_FAIL_INDEX(p_mode, 3): the setter refuses.
  billboard: v.enumInt(
    'billboard',
    BillboardMode.BILLBOARD_DISABLED,
    BillboardMode.BILLBOARD_FIXED_Y,
    SPRITE_BILLBOARD_MODE_NAMES,
    { enforced: 'label_3d.cpp:1001' }
  ),
  modulate: v.color('modulate'),
  // label_3d.cpp:155 hints "0,127,1,suffix:px", closed at both ends.
  // set_outline_size:873-880 is a bare assignment, so both ends warn. `v.int`,
  // like `font_size` below: the slot is Variant::INT, so it also owes the shared
  // truncation warning and the unstorable-literal refusal.
  outline_size: v.int('outline_size', {
    min: 0,
    max: 127,
    hinted: 'label_3d.cpp:155',
  }),
  outline_modulate: v.color('outline_modulate'),
  // label_3d.cpp:154 hints "1,256,1,or_greater" and declares Variant::INT;
  // set_font_size:861-868 is a bare assignment (only guarded against a
  // redundant set), so the floor is the hint's and `or_greater` opens the top.
  font_size: v.int('font_size', { min: 1, hinted: 'label_3d.cpp:154' }),
  // line_spacing can be negative, so no bound here.
  line_spacing: v.float('line_spacing'),
  // set_horizontal_alignment:678, ERR_FAIL_INDEX((int)p_alignment, 4): the
  // setter refuses.
  horizontal_alignment: v.enumInt(
    'horizontal_alignment',
    HORIZONTAL_ALIGNMENT_LEFT,
    HORIZONTAL_ALIGNMENT_FILL,
    HORIZONTAL_ALIGNMENT_NAMES,
    {
      enforced: 'label_3d.cpp:678',
    }
  ),
  no_depth_test: v.boolean('no_depth_test'),
  // label_3d.cpp:146, PROPERTY_HINT_RANGE built from
  // RS::MATERIAL_RENDER_PRIORITY_MIN/MAX. set_render_priority:766 opens with
  // ERR_FAIL_COND on that same range, so the bound is enforced, not hinted:
  // Godot refuses the write outright rather than clamping it.
  render_priority: v.int('render_priority', {
    min: MATERIAL_RENDER_PRIORITY_MIN,
    max: MATERIAL_RENDER_PRIORITY_MAX,
    enforced: 'label_3d.cpp:766',
  }),
  // label_3d.cpp:147 and set_outline_render_priority:778, the identical shape.
  outline_render_priority: v.int('outline_render_priority', {
    min: MATERIAL_RENDER_PRIORITY_MIN,
    max: MATERIAL_RENDER_PRIORITY_MAX,
    enforced: 'label_3d.cpp:778',
  }),
  // ADD_PROPERTYI draw flags (label_3d.cpp:136-139). set_draw_flag:987-993
  // ERR_FAIL_INDEXes the FLAG index, a compile-time constant baked into the
  // registration, never the bool value, so the property itself carries no bound.
  shaded: v.boolean('shaded'),
  double_sided: v.boolean('double_sided'),
  fixed_size: v.boolean('fixed_size'),
  // label_3d.cpp:158, PROPERTY_HINT_NONE. set_uppercase:753-759 bare-assigns.
  uppercase: v.boolean('uppercase'),
  // label_3d.cpp:167, PROPERTY_HINT_LOCALE_ID (no hint_string). set_language:
  // 717-723 bare-assigns, so any quoted string loads.
  language: v.quotedString('language'),
  // label_3d.cpp:132 hints only "suffix:px" (PROPERTY_HINT_NONE); set_offset:
  // 965-970 bare-assigns, so any Vector2 loads.
  offset: v.vector2('offset'),
  // label_3d.cpp:163 hints only "suffix:px" (PROPERTY_HINT_NONE, no bound);
  // set_width:942-948 bare-assigns.
  width: v.float('width'),
  // label_3d.cpp:153, PROPERTY_HINT_RESOURCE_TYPE "Font". set_font:794-806
  // reassigns unconditionally; format-only, same pattern as Label's
  // label_settings.
  font: v.resourceReference('font'),
  // label_3d.cpp:169, Variant::ARRAY (not a TypedArray, per label_3d.h:134's
  // plain `Array st_args`), no hint. set_structured_text_bidi_override_options:
  // 741-747 assigns straight through, so this only rejects a malformed
  // literal. Same pattern as Label's/LinkButton's/LineEdit's identical property.
  structured_text_bidi_override_options: v.arrayLiteral('structured_text_bidi_override_options'),
  // label_3d.cpp:141 hints "0,1,0.001" (closed); set_alpha_scissor_threshold:
  // 1047-1052 is a bare assignment, so out-of-hint is a warning.
  alpha_scissor_threshold: v.float('alpha_scissor_threshold', {
    min: 0,
    max: 1,
    hinted: 'label_3d.cpp:141',
  }),
  // label_3d.cpp:142 hints "0,2,0.01" (closed); set_alpha_hash_scale:1036-1041
  // is a bare assignment, so out-of-hint is a warning.
  alpha_hash_scale: v.float('alpha_hash_scale', { min: 0, max: 2, hinted: 'label_3d.cpp:142' }),
  // label_3d.cpp:144 hints "0,1,0.01" (closed); set_alpha_antialiasing_edge:
  // 1069-1074 is a bare assignment, so out-of-hint is a warning.
  alpha_antialiasing_edge: v.float('alpha_antialiasing_edge', {
    min: 0,
    max: 1,
    hinted: 'label_3d.cpp:144',
  }),
  // label_3d.cpp:143 hints 3 labels (0-2); set_alpha_antialiasing:1058-1063
  // is a bare assignment (no ERR_FAIL), so out-of-hint is a warning.
  alpha_antialiasing_mode: v.enumInt(
    'alpha_antialiasing_mode',
    AlphaAntiAliasing.OFF,
    AlphaAntiAliasing.ALPHA_TO_COVERAGE_AND_TO_ONE,
    ALPHA_ANTIALIASING_NAMES,
    { hinted: 'label_3d.cpp:143' }
  ),
  // label_3d.cpp:168: PROPERTY_HINT_ENUM, 7 labels. set_structured_text_bidi_override
  // (label_3d.cpp:729-735) assigns unconditionally, no ERR_FAIL.
  structured_text_bidi_override: v.enumInt(
    'structured_text_bidi_override',
    StructuredTextParser.STRUCTURED_TEXT_DEFAULT,
    StructuredTextParser.STRUCTURED_TEXT_CUSTOM,
    STRUCTURED_TEXT_PARSER_NAMES,
    { hinted: 'label_3d.cpp:168' }
  ),
  // label_3d.cpp:160: PROPERTY_HINT_ENUM "Off,Arbitrary,Word,Word (Smart)",
  // the whole 4-value AutowrapMode enum. set_autowrap_mode:906-912 assigns
  // unconditionally, no ERR_FAIL.
  autowrap_mode: v.enumInt(
    'autowrap_mode',
    AutowrapMode.AUTOWRAP_OFF,
    AutowrapMode.AUTOWRAP_WORD_SMART,
    AUTOWRAP_MODE_NAMES,
    { hinted: 'label_3d.cpp:160' }
  ),
  // label_3d.cpp:145 hints 6 labels (0-5); set_texture_filter:1021-1026 is a
  // bare assignment (no ERR_FAIL), so out-of-hint is a warning.
  texture_filter: v.enumInt(
    'texture_filter',
    TextureFilter.NEAREST,
    TextureFilter.LINEAR_WITH_MIPMAPS_ANISOTROPIC,
    TEXTURE_FILTER_NAMES,
    { hinted: 'label_3d.cpp:145' }
  ),
  // set_alpha_cut_mode:1013, ERR_FAIL_INDEX(p_mode, ALPHA_CUT_MAX): the setter
  // refuses.
  alpha_cut: v.enumInt('alpha_cut', AlphaCutMode.DISABLED, AlphaCutMode.HASH, ALPHA_CUT_NAMES, {
    enforced: 'label_3d.cpp:1013',
  }),
  // Two tiers, both reachable: label_3d.cpp:157 hints "Top,Center,Bottom" and
  // set_vertical_alignment:693 refuses only at ERR_FAIL_INDEX((int)…, 4), so
  // FILL loads and warns while 4 and up error.
  vertical_alignment: v.enumInt(
    'vertical_alignment',
    VERTICAL_ALIGNMENT_TOP,
    VERTICAL_ALIGNMENT_BOTTOM,
    VERTICAL_ALIGNMENT_NAMES,
    {
      hinted: 'label_3d.cpp:157',
      enforced: 'label_3d.cpp:693',
      enforcedMax: { at: 3 },
    }
  ),
  // set_text_direction:705, `ERR_FAIL_COND((int)p_text_direction < -1 ||
  // (int)p_text_direction > 3)`, is enforced. -1 is a legacy spelling with no
  // named constant, so it is legal but unlabelled, as in Label.
  text_direction: v.enumInt(
    'text_direction',
    TextDirection.TEXT_DIRECTION_AUTO,
    TextDirection.TEXT_DIRECTION_RTL,
    TEXT_DIRECTION_NAMES,
    {
      hinted: 'label_3d.cpp:166',
      enforced: 'label_3d.cpp:705',
      enforcedMin: { at: -1 },
      enforcedMax: { at: 3 },
    }
  ),
  // set_autowrap_trim_flags:920 stores `p_flags & TextServer::BREAK_TRIM_MASK`,
  // so bits outside the mask are dropped. label_3d.cpp:161 hints only the two
  // edge-space bits, so BREAK_TRIM_INDENT is kept but not offered by the inspector.
  autowrap_trim_flags: maskedBitField('autowrap_trim_flags', BREAK_TRIM_MASK, {
    enforced: 'label_3d.cpp:920',
    labels: BREAK_TRIM_LABELS,
    hintedBits: BREAK_TRIM_HINTED_BITS,
  }),
  // label_3d.cpp:162: PROPERTY_HINT_FLAGS naming 6 of the 8 JustificationFlag
  // bits. set_justification_flags:930-936 has no mask, so bits 4 and 16 are kept,
  // unreachable from the inspector: the hint's warning tier, not a mask's error.
  justification_flags: hintedBitField('justification_flags', {
    hinted: 'label_3d.cpp:162',
    labels: JUSTIFICATION_HINTED_BITS,
  }),
});
