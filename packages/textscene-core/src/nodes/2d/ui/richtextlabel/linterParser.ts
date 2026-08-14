/**
 * RichTextLabel strict validators for linting.
 *
 * Declare only RichTextLabel's OWN members, the ones doc/classes/RichTextLabel.xml
 * lists without an `overrides=` attribute. `clip_contents` and `focus_mode` are
 * skipped: both carry `overrides="Control"` there, and rich_text_label.cpp's
 * `_bind_methods` never re-declares either with its own `ADD_PROPERTY` (only the
 * 30 members below appear between rich_text_label.cpp:7754-7796), so both
 * validators belong to Control and would duplicate the rule here.
 *
 * Grouped to match the ADD_GROUP structure rich_text_label.cpp:7754-7796 actually
 * uses: an ungrouped run of text/scroll/wrap/layout properties, then Markup,
 * Threading, Text Selection, Displayed Text, and BiDi.
 *
 * A pre-4.x compatibility alias, `bbcode_text`, is handled by RichTextLabel's own
 * `_set` override (rich_text_label.cpp:7562-7568, `#ifndef DISABLE_DEPRECATED`)
 * forwarding to `set_text`. It carries no `ADD_PROPERTY` and never appears in
 * `doc/classes/RichTextLabel.xml`, so it registers no validator here (see the
 * task report for why this is a parser gap worth flagging rather than a linter one).
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { hintedBitField, maskedBitField, propertyError, shape, v } from '../../../../linter/validators/index.js';
import {
  AUTOWRAP_MODE,
  BREAK_TRIM_HINTED_BITS,
  BREAK_TRIM_LABELS,
  BREAK_TRIM_MASK,
  JUSTIFICATION_HINTED_BITS,
  STRUCTURED_TEXT_PARSER,
  TEXT_DIRECTION,
} from '../../../../linter/validators/textServerEnums.js';
import { packedArrayLiteral } from '../../../../godot/index.js';
import { firstNonNumericElement } from '../../../../linter/validators/v/packedArrays.js';

// rich_text_label.cpp:7767: PROPERTY_HINT_ENUM "Left,Center,Right,Fill", the
// full 4-member HorizontalAlignment enum (core/math/math_defs.h:80-84). Not
// shared with Button's own copy: each slice cites its own ADD_PROPERTY line.
const HORIZONTAL_ALIGNMENT = {
  0: 'HORIZONTAL_ALIGNMENT_LEFT',
  1: 'HORIZONTAL_ALIGNMENT_CENTER',
  2: 'HORIZONTAL_ALIGNMENT_RIGHT',
  3: 'HORIZONTAL_ALIGNMENT_FILL',
} as const;

// rich_text_label.cpp:7768: PROPERTY_HINT_ENUM "Top,Center,Bottom,Fill", the
// full 4-member VerticalAlignment enum.
const VERTICAL_ALIGNMENT = {
  0: 'VERTICAL_ALIGNMENT_TOP',
  1: 'VERTICAL_ALIGNMENT_CENTER',
  2: 'VERTICAL_ALIGNMENT_BOTTOM',
  3: 'VERTICAL_ALIGNMENT_FILL',
} as const;

// rich_text_label.cpp:7789: PROPERTY_HINT_ENUM "Characters Before
// Shaping,Characters After Shaping,Glyphs (Layout Direction),Glyphs
// (Left-to-Right),Glyphs (Right-to-Left)", TextServer::VisibleCharactersBehavior
// (servers/text/text_server.h:90-96, declaration order == bind order).
const VISIBLE_CHARACTERS_BEHAVIOR = {
  0: 'VC_CHARS_BEFORE_SHAPING',
  1: 'VC_CHARS_AFTER_SHAPING',
  2: 'VC_GLYPHS_AUTO',
  3: 'VC_GLYPHS_LTR',
  4: 'VC_GLYPHS_RTL',
} as const;

/**
 * `PackedFloat32Array(...)` format for `tab_stops`. `set_tab_stops`
 * (rich_text_label.cpp:7295-7308) bare-assigns the whole array with no
 * ERR_FAIL and no per-element check, so only the TSCN literal shape is worth
 * rejecting: an arbitrary-length list of numbers, empty allowed
 * (`PackedFloat32Array()` is the documented default).
 */
const PACKED_FLOAT32_ARRAY_RE = packedArrayLiteral('PackedFloat32Array');

function packedFloat32ArrayValidator(name: string, code: string) {
  return shape((key, value, line) => {
    const match = PACKED_FLOAT32_ARRAY_RE.exec(value);
    if (!match) {
      return propertyError(
        key,
        line,
        `Property '${name}' must be a PackedFloat32Array like PackedFloat32Array(4, 8, 12), got: ${value}`,
        code
      );
    }
    const body = match[1]!.trim();
    if (body === '') return null;
    const offender = firstNonNumericElement(body);
    if (offender !== null) {
      return propertyError(
        key,
        line,
        `Property '${name}' contains a non-numeric value: "${offender}"`,
        code
      );
    }
    return null;
  }, 'PackedFloat32Array(x, y, …)');
}

validatorRegistry.registerAll('RichTextLabel', {
  // Ungrouped run (rich_text_label.cpp:7754-7770).
  // rich_text_label.cpp:7754: bare BOOL, no hint.
  bbcode_enabled: v.boolean('bbcode_enabled'),
  // rich_text_label.cpp:7755: Variant::STRING, PROPERTY_HINT_MULTILINE_TEXT.
  text: v.quotedString('text'),
  // rich_text_label.cpp:7757: bare BOOL, no hint.
  fit_content: v.boolean('fit_content'),
  // rich_text_label.cpp:7758: bare BOOL, no hint. set_scroll_active
  // (rich_text_label.cpp:5182-5192) is an unconditional assignment.
  scroll_active: v.boolean('scroll_active'),
  // rich_text_label.cpp:7759: bare BOOL, no hint. set_scroll_follow
  // (rich_text_label.cpp:5198-5203) is an unconditional assignment.
  scroll_following: v.boolean('scroll_following'),
  // rich_text_label.cpp:7760: bare BOOL, no hint. set_scroll_follow_visible_characters
  // (rich_text_label.cpp:5223-5228) is an unconditional assignment.
  scroll_following_visible_characters: v.boolean('scroll_following_visible_characters'),
  // rich_text_label.cpp:7761: PROPERTY_HINT_ENUM "Off,Arbitrary,Word,Word
  // (Smart)", the FULL 4-member AutowrapMode enum (unlike Button/TextEdit's
  // hint, which omits AUTOWRAP_OFF). set_autowrap_mode (rich_text_label.cpp:7370-7380)
  // is a bare assignment, so the bound is a warning, not an error.
  autowrap_mode: v.enumInt('autowrap_mode', 0, 3, AUTOWRAP_MODE, {
    hinted: 'rich_text_label.cpp:7761',
  }),
  // set_autowrap_trim_flags (rich_text_label.cpp:7390) stores `p_flags &
  // BREAK_TRIM_MASK`, so bits outside the mask are dropped and the stored value
  // is not the written one. rich_text_label.cpp:7762 hints only the two
  // edge-space bits, narrower than the mask, so BREAK_TRIM_INDENT is kept but
  // not offered by the inspector.
  autowrap_trim_flags: maskedBitField('autowrap_trim_flags', BREAK_TRIM_MASK, {
    enforced: 'rich_text_label.cpp:7390',
    labels: BREAK_TRIM_LABELS,
    hintedBits: BREAK_TRIM_HINTED_BITS,
  }),
  // rich_text_label.cpp:7763: PROPERTY_HINT_RANGE "0,24,1", no or_greater/or_less,
  // so both ends are closed. set_tab_size (rich_text_label.cpp:5124-5136) is a
  // bare assignment, so out-of-hint is a warning, not an error.
  tab_size: v.int('tab_size', { min: 0, max: 24, hinted: 'rich_text_label.cpp:7763' }),
  // rich_text_label.cpp:7764: bare BOOL, no hint. set_context_menu_enabled
  // (rich_text_label.cpp:6985-6987) is an unconditional assignment.
  context_menu_enabled: v.boolean('context_menu_enabled'),
  // rich_text_label.cpp:7765: bare BOOL, no hint. set_shortcut_keys_enabled
  // (rich_text_label.cpp:6993-6995) is an unconditional assignment.
  shortcut_keys_enabled: v.boolean('shortcut_keys_enabled'),
  // rich_text_label.cpp:7767: set_horizontal_alignment (rich_text_label.cpp:7241-7255)
  // opens with `ERR_FAIL_INDEX((int)p_alignment, 4)` (line 7242): the setter
  // REFUSES an out-of-range write, so this is an error, not a warning.
  horizontal_alignment: v.enumInt('horizontal_alignment', 0, 3, HORIZONTAL_ALIGNMENT, {
    enforced: 'rich_text_label.cpp:7242',
  }),
  // rich_text_label.cpp:7768: set_vertical_alignment (rich_text_label.cpp:7261-7270)
  // opens with `ERR_FAIL_INDEX((int)p_alignment, 4)` (line 7262): enforced.
  vertical_alignment: v.enumInt('vertical_alignment', 0, 3, VERTICAL_ALIGNMENT, {
    enforced: 'rich_text_label.cpp:7262',
  }),
  // rich_text_label.cpp:7769: PROPERTY_HINT_FLAGS listing 6 of the 8
  // rich_text_label.cpp:7769 — PROPERTY_HINT_FLAGS naming 6 of the 8 JustificationFlag bits.
  // The setter bare-assigns with no mask, so bits 4 and 16 are KEPT rather than
  // dropped: unreachable from the inspector, not refused, which is the hint's
  // warning tier and not the mask's error tier (contrast autowrap_trim_flags).
  justification_flags: hintedBitField('justification_flags', {
    hinted: 'rich_text_label.cpp:7769',
    labels: JUSTIFICATION_HINTED_BITS,
  }),
  // rich_text_label.cpp:7770: Variant::PACKED_FLOAT32_ARRAY, no hint.
  // set_tab_stops (rich_text_label.cpp:7295-7308) is a bare assignment.
  tab_stops: packedFloat32ArrayValidator('tab_stops', 'INVALID_TAB_STOPS_FORMAT'),

  // Markup (ADD_GROUP "Markup", "", rich_text_label.cpp:7772-7775).
  // rich_text_label.cpp:7773: Variant::ARRAY, PROPERTY_HINT_ARRAY_TYPE
  // "RichTextEffect". set_effects (rich_text_label.cpp:7465-7468) is a bare
  // assignment (`custom_effects = Array(p_effects);`) with no per-element check.
  // PROPERTY_HINT_ARRAY_TYPE "RichTextEffect" makes `Array::is_typed()` true, so
  // the writer emits the `Array[RichTextEffect]([...])` wrapper here.
  custom_effects: v.arrayLiteral('custom_effects', { typedAs: 'RichTextEffect' }),
  // rich_text_label.cpp:7774: bare BOOL, no hint. set_meta_underline
  // (rich_text_label.cpp:5155-5162) is an unconditional assignment.
  meta_underlined: v.boolean('meta_underlined'),
  // rich_text_label.cpp:7775: bare BOOL, no hint. set_hint_underline
  // (rich_text_label.cpp:5168-5171) is an unconditional assignment.
  hint_underlined: v.boolean('hint_underlined'),

  // Threading (ADD_GROUP "Threading", "", rich_text_label.cpp:7777-7779).
  // rich_text_label.cpp:7778: bare BOOL, no hint. set_threaded
  // (rich_text_label.cpp:3781-3787) is an unconditional assignment.
  threaded: v.boolean('threaded'),
  // rich_text_label.cpp:7779: PROPERTY_HINT_NONE, hint string is only
  // "suffix:ms" (a display unit, not a range). set_progress_bar_delay
  // (rich_text_label.cpp:3793-3795) stores the int with no clamp and no
  // ERR_FAIL at all; the only read site, rich_text_label.cpp:2574, treats
  // <= 0 as "never show the bar" rather than as an invalid value. Nothing
  // to ground: format-only.
  progress_bar_delay: v.int('progress_bar_delay'),

  // Text Selection (ADD_GROUP "Text Selection", "", rich_text_label.cpp:7781-7784).
  // rich_text_label.cpp:7782: bare BOOL, PROPERTY_HINT_GROUP_ENABLE (an
  // inspector grouping toggle, not a value constraint; RichTextLabel overrides
  // no `_validate_property` that would hide a sibling behind it).
  // set_selection_enabled (rich_text_label.cpp:6683-6698) is unconditional.
  selection_enabled: v.boolean('selection_enabled'),
  // rich_text_label.cpp:7783: bare BOOL, no hint. set_deselect_on_focus_loss_enabled
  // (rich_text_label.cpp:6700-6709) is an unconditional assignment.
  deselect_on_focus_loss_enabled: v.boolean('deselect_on_focus_loss_enabled'),
  // rich_text_label.cpp:7784: bare BOOL, no hint. set_drag_and_drop_selection_enabled
  // (rich_text_label.cpp:7094-7096) is an unconditional assignment.
  drag_and_drop_selection_enabled: v.boolean('drag_and_drop_selection_enabled'),

  // Displayed Text (ADD_GROUP "Displayed Text", "", rich_text_label.cpp:7786-7790).
  // rich_text_label.cpp:7788: PROPERTY_HINT_RANGE "-1,128000,1", both ends
  // closed (no or_greater/or_less). set_visible_characters
  // (rich_text_label.cpp:7892-7948) bare-assigns `visible_characters =
  // p_visible` with no clamp, so both ends warn. -1 is the hint's own floor
  // and the "all characters displayed" sentinel. Matches Label, which binds
  // the same property with the same hint (label.cpp:1450).
  visible_characters: v.int('visible_characters', {
    min: -1,
    max: 128000,
    hinted: 'rich_text_label.cpp:7788',
  }),
  // rich_text_label.cpp:7789: PROPERTY_HINT_ENUM, 5 entries (0-4).
  // set_visible_characters_behavior (rich_text_label.cpp:7880-7890) is a bare
  // assignment.
  visible_characters_behavior: v.enumInt(
    'visible_characters_behavior',
    0,
    4,
    VISIBLE_CHARACTERS_BEHAVIOR,
    { hinted: 'rich_text_label.cpp:7789' }
  ),
  // rich_text_label.cpp:7790: PROPERTY_HINT_RANGE "0,1,0.001". set_visible_ratio
  // (rich_text_label.cpp:7401-7459) CLAMPS: `p_ratio >= 1.0` stores 1.0
  // (rich_text_label.cpp:7406-7408) and `p_ratio < 0.0` stores 0.0
  // (rich_text_label.cpp:7409-7411): the setter alters what was written, so
  // this is an error, not a warning.
  visible_ratio: v.float('visible_ratio', {
    min: 0,
    max: 1,
    enforced: 'rich_text_label.cpp:7406-7411',
  }),

  // BiDi (ADD_GROUP "BiDi", "", rich_text_label.cpp:7792-7796).
  // rich_text_label.cpp:7793: set_text_direction (rich_text_label.cpp:7220-7235)
  // opens with `ERR_FAIL_COND((int)p_text_direction < -1 || > 3)` (line 7221):
  // enforced, and -1 is a legacy inherited spelling with no named constant but
  // still engine-legal, same as TextEdit's own copy of this property.
  text_direction: v.enumInt('text_direction', -1, 3, TEXT_DIRECTION, {
    enforced: 'rich_text_label.cpp:7221',
  }),
  // rich_text_label.cpp:7794: Variant::STRING, PROPERTY_HINT_LOCALE_ID.
  // set_language (rich_text_label.cpp:7350-7364) is a bare assignment.
  language: v.quotedString('language'),
  // rich_text_label.cpp:7795: PROPERTY_HINT_ENUM, 7 entries (0-6).
  // set_structured_text_bidi_override (rich_text_label.cpp:7314-7328) is a
  // bare assignment.
  structured_text_bidi_override: v.enumInt(
    'structured_text_bidi_override',
    0,
    6,
    STRUCTURED_TEXT_PARSER,
    { hinted: 'rich_text_label.cpp:7795' }
  ),
  // rich_text_label.cpp:7796: Variant::ARRAY, no hint at all (so it is never
  // written with the `Array[Type](...)` wrapper, unlike custom_effects above).
  // set_structured_text_bidi_override_options (rich_text_label.cpp:7334-7344)
  // is a bare assignment.
  structured_text_bidi_override_options: v.arrayLiteral('structured_text_bidi_override_options'),
});
