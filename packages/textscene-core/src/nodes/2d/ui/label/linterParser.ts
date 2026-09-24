/**
 * Label strict validators: only the members doc/classes/Label.xml lists without
 * `overrides=`, since the NODE_BASE_TYPES walk delivers inherited keys and a
 * re-declared key shadows one. `mouse_filter` and `size_flags_vertical` are Control
 * default overrides that label.cpp never re-declares (parser.ts's `LABEL_DEFAULT_V_SIZE_FLAGS`).
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { hintedBitField, maskedBitField, v } from '../../../../linter/validators/index.js';
import {
  AUTOWRAP_MODE,
  BREAK_TRIM_HINTED_BITS,
  BREAK_TRIM_LABELS,
  BREAK_TRIM_MASK,
  JUSTIFICATION_HINTED_BITS,
  OVERRUN_BEHAVIOR,
  STRUCTURED_TEXT_PARSER,
  TEXT_DIRECTION,
} from '../../../../linter/validators/textServerEnums.js';
import { HORIZONTAL_ALIGNMENT, VERTICAL_ALIGNMENT } from '../../../../linter/validators/globalScopeEnums.js';



/**
 * `TextServer::VisibleCharactersBehavior` (servers/text/text_server.h:90-96),
 * label.cpp:1451 hint with 5 entries.
 */
const VISIBLE_CHARACTERS_BEHAVIOR = {
  0: 'VC_CHARS_BEFORE_SHAPING',
  1: 'VC_CHARS_AFTER_SHAPING',
  2: 'VC_GLYPHS_AUTO',
  3: 'VC_GLYPHS_LTR',
  4: 'VC_GLYPHS_RTL',
};

/**
 * label.cpp:1258-1275: `set_ellipsis_char` truncates a longer literal with
 * `c = c.left(1)` after a `WARN_PRINT` (label.cpp:1260-1262). The setter alters
 * the value, so it is an error (ADR-0032); there is no `PROPERTY_HINT` (label.cpp:1442).
 */
const ellipsisCharValidator = v.singleCharacter('ellipsis_char', {
  enforced: 'label.cpp:1260',
});

/**
 * `tab_stops`: a `PackedFloat32Array` with no hint (label.cpp:1444), which
 * `set_tab_stops` (label.cpp:1225-1233) assigns with no arity or value bound, so
 * only an unreadable literal fails.
 */
const tabStopsValidator = v.packedFloat32Array('tab_stops', '10, 20, 30');

// The map follows label.cpp:1431-1458's ADD_GROUP order and matches the verdicts
// Button, LineEdit and LinkButton give the same properties. `Label::_set`
// (label.cpp:1000-1011, `#ifndef DISABLE_DEPRECATED`) also takes the pre-4.0 `align`
// and `valign`, which `godot/deprecatedTable.ts` maps onto the alignment keys.
validatorRegistry.registerAll('Label', {
  // -- Ungrouped run (label.cpp:1431-1444) ------------------------------------
  // label.cpp:1431: PROPERTY_HINT_MULTILINE_TEXT, no length bound.
  // set_text (label.cpp:1099-1113) assigns unconditionally.
  text: v.quotedString('text'),
  // label.cpp:1432: PROPERTY_HINT_RESOURCE_TYPE "LabelSettings".
  // set_label_settings (label.cpp:1121-1133) reassigns unconditionally.
  label_settings: v.resourceReference('label_settings'),
  // label.cpp:1433: PROPERTY_HINT_ENUM "Left,Center,Right,Fill", the 4
  // HorizontalAlignment constants. set_horizontal_alignment (label.cpp:1064-1078),
  // `ERR_FAIL_INDEX((int)p_alignment, 4)` (label.cpp:1065), enforced.
  horizontal_alignment: v.enumInt('horizontal_alignment', 0, 3, HORIZONTAL_ALIGNMENT, {
    enforced: 'label.cpp:1065',
  }),
  // label.cpp:1434: PROPERTY_HINT_ENUM "Top,Center,Bottom,Fill", the 4
  // VerticalAlignment constants. set_vertical_alignment (label.cpp:1084-1093),
  // `ERR_FAIL_INDEX((int)p_alignment, 4)` (label.cpp:1085), enforced.
  vertical_alignment: v.enumInt('vertical_alignment', 0, 3, VERTICAL_ALIGNMENT, {
    enforced: 'label.cpp:1085',
  }),
  // label.cpp:1435: PROPERTY_HINT_ENUM "Off,Arbitrary,Word,Word (Smart)", the
  // whole 4-value AutowrapMode enum. set_autowrap_mode (label.cpp:37-52)
  // assigns unconditionally, no ERR_FAIL.
  autowrap_mode: v.enumInt('autowrap_mode', 0, 3, AUTOWRAP_MODE, { hinted: 'label.cpp:1435' }),
  // set_autowrap_trim_flags (label.cpp:63) stores `p_flags & BREAK_TRIM_MASK`, so
  // bits outside the mask drop. label.cpp:1436 hints only the two edge-space bits,
  // so BREAK_TRIM_INDENT is kept but not offered by the inspector.
  autowrap_trim_flags: maskedBitField('autowrap_trim_flags', BREAK_TRIM_MASK, {
    enforced: 'label.cpp:63',
    labels: BREAK_TRIM_LABELS,
    hintedBits: BREAK_TRIM_HINTED_BITS,
  }),
  // label.cpp:1437: PROPERTY_HINT_FLAGS naming 6 of the 8 JustificationFlag bits.
  // The setter bare-assigns with no mask, so bits 4 and 16 are kept rather than
  // dropped: unreachable from the inspector, not refused, which is the hint's
  // warning tier and not the mask's error tier (contrast autowrap_trim_flags).
  justification_flags: hintedBitField('justification_flags', {
    hinted: 'label.cpp:1437',
    labels: JUSTIFICATION_HINTED_BITS,
  }),
  // label.cpp:1438: Variant::STRING, PROPERTY_HINT_NONE. set_paragraph_separator
  // (label.cpp:1198-1205) assigns unconditionally.
  paragraph_separator: v.quotedString('paragraph_separator'),
  // label.cpp:1440: Variant::BOOL. set_clip_text (label.cpp:1211-1219) assigns
  // unconditionally.
  clip_text: v.boolean('clip_text'),
  // label.cpp:1441: PROPERTY_HINT_ENUM with 7 entries; TextServer::OverrunBehavior
  // OVERRUN_NO_TRIMMING=0 .. OVERRUN_TRIM_WORD_ELLIPSIS_FORCE=6. set_text_overrun_behavior
  // (label.cpp:1239-1252) assigns unconditionally, no ERR_FAIL.
  text_overrun_behavior: v.enumInt('text_overrun_behavior', 0, 6, OVERRUN_BEHAVIOR, {
    hinted: 'label.cpp:1441',
  }),
  // label.cpp:1442: see ellipsisCharValidator above.
  ellipsis_char: ellipsisCharValidator,
  // label.cpp:1443: Variant::BOOL. set_uppercase (label.cpp:95-105) assigns
  // unconditionally.
  uppercase: v.boolean('uppercase'),
  // label.cpp:1444: see tabStopsValidator above.
  tab_stops: tabStopsValidator,

  // -- Displayed Text (ADD_GROUP "Displayed Text", "", label.cpp:1446-1452) --
  // label.cpp:1447: PROPERTY_HINT_RANGE "0,999,1". set_lines_skipped
  // (label.cpp:1345-1355), `ERR_FAIL_COND(p_lines < 0)` (label.cpp:1346),
  // enforces the floor; the 999 ceiling is only the hint, so it is a warning.
  lines_skipped: v.int('lines_skipped', {
    min: 0,
    max: 999,
    enforced: { min: 'label.cpp:1346' },
    hinted: { max: 'label.cpp:1447' },
  }),
  // label.cpp:1448: PROPERTY_HINT_RANGE "-1,999,1". set_max_lines_visible
  // (label.cpp:1361-1369) is a bare assignment with no ERR_FAIL and no clamp
  // at all, so both ends are only the hint (warning, not error). -1 is the
  // documented "no limit" sentinel.
  max_lines_visible: v.int('max_lines_visible', { min: -1, max: 999, hinted: 'label.cpp:1448' }),
  // label.cpp:1450: PROPERTY_HINT_RANGE "-1,128000,1", both ends closed (no
  // or_greater). set_visible_characters (label.cpp:1285-1299) is a bare
  // assignment with no ERR_FAIL and no clamp, so both ends are warnings. -1 is
  // the hint's own floor and the "show all" sentinel.
  visible_characters: v.int('visible_characters', {
    min: -1,
    max: 128000,
    hinted: 'label.cpp:1450',
  }),
  // label.cpp:1451: PROPERTY_HINT_ENUM with 5 entries.
  // set_visible_characters_behavior (label.cpp:1334-1343) assigns
  // unconditionally, no ERR_FAIL.
  visible_characters_behavior: v.enumInt(
    'visible_characters_behavior',
    0,
    4,
    VISIBLE_CHARACTERS_BEHAVIOR,
    { hinted: 'label.cpp:1451' }
  ),
  // label.cpp:1452: PROPERTY_HINT_RANGE "0,1,0.001", a warning (ADR-0032), since the clamp
  // at label.cpp:1307-1312 sits behind `if (visible_ratio != p_ratio)` (label.cpp:1305) and
  // properties apply in file order (packed_scene.cpp:492). After `text = "0"` and
  // `visible_characters = 3`, `visible_ratio = 3.0` stores and re-saves 3.0; alone it clamps to 1.0.
  visible_ratio: v.float('visible_ratio', {
    min: 0,
    max: 1,
    hinted: 'label.cpp:1452',
  }),

  // -- BiDi (ADD_GROUP "BiDi", "", label.cpp:1454-1458) -----------------------

  // label.cpp:1455: PROPERTY_HINT_ENUM "Auto,Left-to-Right,Right-to-Left,Inherited".
  // set_text_direction (label.cpp:1139-1148) enforces
  // `ERR_FAIL_COND((int)p_text_direction < -1 || (int)p_text_direction > 3)` (label.cpp:1140).
  // -1 is a legacy inherited spelling with no named constant: legal but unlabelled.
  text_direction: v.enumInt('text_direction', 0, 3, TEXT_DIRECTION, {
    hinted: 'label.cpp:1455',
    enforced: 'label.cpp:1140',
    enforcedMin: { at: -1 },
  }),
  // label.cpp:1456: PROPERTY_HINT_LOCALE_ID; any locale string parses.
  // set_language (label.cpp:1184-1192) assigns unconditionally.
  language: v.quotedString('language'),
  // label.cpp:1457: PROPERTY_HINT_ENUM, 7 labels. set_structured_text_bidi_override
  // (label.cpp:1150-1158) assigns unconditionally, no ERR_FAIL.
  structured_text_bidi_override: v.enumInt(
    'structured_text_bidi_override',
    0,
    6,
    STRUCTURED_TEXT_PARSER,
    { hinted: 'label.cpp:1457' }
  ),
  // label.cpp:1458: Variant::ARRAY with no hint at all, so it is never written
  // wrapped. set_structured_text_bidi_override_options (label.cpp:1164-1174)
  // assigns straight through, leaving only the literal shape to reject.
  structured_text_bidi_override_options: v.arrayLiteral('structured_text_bidi_override_options'),
});
