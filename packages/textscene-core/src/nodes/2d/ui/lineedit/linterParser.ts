/**
 * LineEdit's strict validators, grouped as the ADD_GROUP calls of line_edit.cpp:3483-3528. Only the members
 * doc/classes/LineEdit.xml lists without `overrides=`: the NODE_BASE_TYPES base-walk delivers Control's, and a
 * re-declared key duplicates the rule. `focus_mode` and `mouse_default_cursor_shape` stay with Control: the constructor only
 * changes their default (line_edit.cpp:3559-3560), and line_edit.cpp's `_bind_methods` (line_edit.cpp:3324-3531) never re-declares them.
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import {
  STRUCTURED_TEXT_PARSER,
  TEXT_DIRECTION,
} from '../../../../linter/validators/textServerEnums.js';
import { HORIZONTAL_ALIGNMENT } from '../../../../linter/validators/globalScopeEnums.js';


/** `LineEdit::VirtualKeyboardType` (line_edit.h, BIND_ENUM_CONSTANT line_edit.cpp:3470-3477). */
const VIRTUAL_KEYBOARD_TYPE = {
  0: 'KEYBOARD_TYPE_DEFAULT',
  1: 'KEYBOARD_TYPE_MULTILINE',
  2: 'KEYBOARD_TYPE_NUMBER',
  3: 'KEYBOARD_TYPE_NUMBER_DECIMAL',
  4: 'KEYBOARD_TYPE_PHONE',
  5: 'KEYBOARD_TYPE_EMAIL_ADDRESS',
  6: 'KEYBOARD_TYPE_PASSWORD',
  7: 'KEYBOARD_TYPE_URL',
};

/**
 * `LineEdit::ExpandMode` (line_edit.cpp:3527 hint "Original,Fit to Text,Fit to
 * LineEdit"; BIND_ENUM_CONSTANT line_edit.cpp:3479-3481).
 */
const EXPAND_MODE = {
  0: 'EXPAND_MODE_ORIGINAL_SIZE',
  1: 'EXPAND_MODE_FIT_TO_TEXT',
  2: 'EXPAND_MODE_FIT_TO_LINE_EDIT',
};

/**
 * line_edit.cpp:2608-2621: `set_secret_character` truncates a longer literal with `c = c.left(1)`
 * (line_edit.cpp:2610-2612) after a `WARN_PRINT`. It alters the value, so this errors (ADR-0032). The
 * property has no `PROPERTY_HINT` (line_edit.cpp:3517). An empty literal is legal and falls back to
 * the bullet at display time (displayText.ts).
 */
const secretCharacterValidator = v.singleCharacter('secret_character', {
  enforced: 'line_edit.cpp:2612',
});

validatorRegistry.registerAll('LineEdit', {
  // Ungrouped run (line_edit.cpp:3483-3501)
  // line_edit.cpp:3483, no hint. set_text truncates in _set_text (line_edit.cpp:2130-2131 / 2090-2128)
  // against max_length, a sibling bound a per-property validator cannot see.
  text: v.quotedString('text'),
  // line_edit.cpp:3484, no hint. set_placeholder (line_edit.cpp:2257-2266) assigns unconditionally.
  placeholder_text: v.quotedString('placeholder_text'),
  // line_edit.cpp:3485, PROPERTY_HINT_ENUM "Left,Center,Right,Fill". set_horizontal_alignment
  // (line_edit.cpp:1071-1079) enforces `ERR_FAIL_INDEX((int)p_alignment, 4)` (line_edit.cpp:1072), the
  // bound SpinBox's `alignment` cites.
  alignment: v.enumInt('alignment', 0, 3, HORIZONTAL_ALIGNMENT, { enforced: 'line_edit.cpp:1072' }),
  // line_edit.cpp:3486, PROPERTY_HINT_RANGE "0,1000,1,or_greater". set_max_length (line_edit.cpp:2520-2524)
  // enforces `ERR_FAIL_COND(p_max_length < 0)` (line_edit.cpp:2521), and `or_greater` opens the ceiling.
  max_length: v.int('max_length', { min: 0, enforced: 'line_edit.cpp:2521' }),
  editable: v.boolean('editable'),
  keep_editing_on_text_submit: v.boolean('keep_editing_on_text_submit'),
  expand_to_text_length: v.boolean('expand_to_text_length'),
  context_menu_enabled: v.boolean('context_menu_enabled'),
  emoji_menu_enabled: v.boolean('emoji_menu_enabled'),
  backspace_deletes_composite_character_enabled: v.boolean(
    'backspace_deletes_composite_character_enabled'
  ),
  clear_button_enabled: v.boolean('clear_button_enabled'),
  shortcut_keys_enabled: v.boolean('shortcut_keys_enabled'),
  middle_mouse_paste_enabled: v.boolean('middle_mouse_paste_enabled'),
  selecting_enabled: v.boolean('selecting_enabled'),
  deselect_on_focus_loss_enabled: v.boolean('deselect_on_focus_loss_enabled'),
  drag_and_drop_selection_enabled: v.boolean('drag_and_drop_selection_enabled'),
  flat: v.boolean('flat'),
  draw_control_chars: v.boolean('draw_control_chars'),
  select_all_on_focus: v.boolean('select_all_on_focus'),

  // Virtual Keyboard (ADD_GROUP "Virtual Keyboard", "virtual_keyboard_", line_edit.cpp:3503-3506)
  // line_edit.cpp:3504: PROPERTY_HINT_GROUP_ENABLE only collapses the group in the inspector. The
  // value is a plain bool.
  virtual_keyboard_enabled: v.boolean('virtual_keyboard_enabled'),
  virtual_keyboard_show_on_focus: v.boolean('virtual_keyboard_show_on_focus'),
  // line_edit.cpp:3506, PROPERTY_HINT_ENUM, 8 labels. set_virtual_keyboard_type (line_edit.cpp:2925-2927) assigns unconditionally.
  virtual_keyboard_type: v.enumInt('virtual_keyboard_type', 0, 7, VIRTUAL_KEYBOARD_TYPE, {
    hinted: 'line_edit.cpp:3506',
  }),

  // Caret (ADD_GROUP "Caret", "caret_", line_edit.cpp:3508-3513)
  caret_blink: v.boolean('caret_blink'),
  // line_edit.cpp:3510 hints "0.1,10,0.01", closed at both ends. The setter refuses only
  // `p_interval <= 0` (line_edit.cpp:2050), so (0, 0.1) and anything past 10 warn.
  caret_blink_interval: v.float('caret_blink_interval', {
    enforcedMin: { at: 0, exclusive: true },
    min: 0.1,
    max: 10,
    enforced: { min: 'line_edit.cpp:2050' },
    hinted: 'line_edit.cpp:3510',
  }),
  // line_edit.cpp:3511, PROPERTY_HINT_RANGE "0,1000,1,or_greater". set_caret_column (line_edit.cpp:2272-2281)
  // clamps a negative value to 0 (line_edit.cpp:2277-2279), so the floor errors. The ceiling clamps to
  // `text.length()`, a sibling bound this validator cannot see.
  caret_column: v.int('caret_column', { min: 0, enforced: 'line_edit.cpp:2277' }),
  caret_force_displayed: v.boolean('caret_force_displayed'),
  caret_mid_grapheme: v.boolean('caret_mid_grapheme'),

  // Secret (ADD_GROUP "Secret", "secret", line_edit.cpp:3515-3517)
  // line_edit.cpp:3516: PROPERTY_HINT_GROUP_ENABLE, a plain bool underneath.
  secret: v.boolean('secret'),
  secret_character: secretCharacterValidator,

  // BiDi (ADD_GROUP "BiDi", "", line_edit.cpp:3519-3523), with the verdicts of TextEdit's linterParser.ts.
  // line_edit.cpp:3520, PROPERTY_HINT_ENUM "Auto,Left-to-Right,Right-to-Left,Inherited". set_text_direction
  // (line_edit.cpp:2155-2171) enforces `ERR_FAIL_COND((int)p_text_direction < -1 || (int)p_text_direction > 3)`
  // (line_edit.cpp:2156). -1 is a legal inherited spelling with no named constant, as in TextEdit and Button.
  text_direction: v.enumInt('text_direction', 0, 3, TEXT_DIRECTION, {
    hinted: 'line_edit.cpp:3520',
    enforced: 'line_edit.cpp:2156',
    enforcedMin: { at: -1 },
  }),
  // line_edit.cpp:3521, PROPERTY_HINT_LOCALE_ID. set_language (line_edit.cpp:2178-2184) assigns unconditionally.
  language: v.quotedString('language'),
  // line_edit.cpp:3522, PROPERTY_HINT_ENUM, 7 labels. set_structured_text_bidi_override (line_edit.cpp:2205-2211) assigns unconditionally.
  structured_text_bidi_override: v.enumInt(
    'structured_text_bidi_override',
    0,
    6,
    STRUCTURED_TEXT_PARSER,
    { hinted: 'line_edit.cpp:3522' }
  ),
  // line_edit.cpp:3523: an ARRAY with no hint, so never written wrapped, of parser-specific arguments
  // with no fixed arity or type. set_structured_text_bidi_override_options (line_edit.cpp:2217-2220)
  // assigns straight through, so only the literal shape is checked.
  structured_text_bidi_override_options: v.arrayLiteral('structured_text_bidi_override_options'),

  // Icon (ADD_GROUP "Icon", "", line_edit.cpp:3525-3528)
  // line_edit.cpp:3526, PROPERTY_HINT_RESOURCE_TYPE "Texture2D". set_right_icon (line_edit.cpp:2986-3000)
  // assigns unconditionally past an identity check.
  right_icon: v.resourceReference('right_icon'),
  // line_edit.cpp:3527, PROPERTY_HINT_ENUM, 3 labels. set_icon_expand_mode (line_edit.cpp:3010-3019) assigns unconditionally.
  icon_expand_mode: v.enumInt('icon_expand_mode', 0, 2, EXPAND_MODE, {
    hinted: 'line_edit.cpp:3527',
  }),
  // line_edit.cpp:3528, PROPERTY_HINT_RANGE "0.1,1.0,0.01", closed at both ends. set_right_icon_scale
  // (line_edit.cpp:3025-3033) assigns unconditionally past an equality check.
  right_icon_scale: v.float('right_icon_scale', {
    min: 0.1,
    max: 1.0,
    hinted: 'line_edit.cpp:3528',
  }),
});
