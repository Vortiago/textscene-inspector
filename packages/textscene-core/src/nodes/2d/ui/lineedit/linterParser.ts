/**
 * LineEdit strict validators for linting.
 *
 * Declare only LineEdit's OWN members: the ones doc/classes/LineEdit.xml lists
 * without an `overrides=` attribute. Everything from Control up is registered
 * on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * `focus_mode` and `mouse_default_cursor_shape` are skipped: doc/classes/LineEdit.xml
 * marks both `overrides="Control"`, and line_edit.cpp's `_bind_methods`
 * (line_edit.cpp:3324-3531) never re-declares either with `ADD_PROPERTY` — the
 * constructor merely calls `set_focus_mode`/`set_default_cursor_shape` to pick a
 * different DEFAULT VALUE (line_edit.cpp:3559-3560), which is not a schema
 * override — so both validators belong to Control and would duplicate the rule
 * here.
 *
 * Grouped to match the ADD_GROUP structure line_edit.cpp:3483-3528 actually
 * uses: an ungrouped run of text/behaviour properties, then Virtual Keyboard,
 * Caret, Secret, BiDi and Icon. Most of this vocabulary — text_direction,
 * language, structured_text_bidi_override(_options) — is shared with TextEdit,
 * the sibling multi-line editor; its linterParser.ts is read first and this
 * file matches its verdicts (both widen text_direction to -1..3, both treat
 * structured_text_bidi_override as hinted-only, both format-check the Array
 * literal without an arity check).
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import {
  STRUCTURED_TEXT_PARSER,
  TEXT_DIRECTION,
} from '../../../../linter/validators/textServerEnums.js';

/**
 * `LineEdit::HorizontalAlignment` reuses Control's shared `HorizontalAlignment`
 * enum (line_edit.cpp:3485 hint "Left,Center,Right,Fill"). Not hoisted to
 * `sharedEnumLabels.ts`: Button declares the identical table locally too, and
 * each class's setter enforces (or not) at its own file:line.
 */
const HORIZONTAL_ALIGNMENT = {
  0: 'HORIZONTAL_ALIGNMENT_LEFT',
  1: 'HORIZONTAL_ALIGNMENT_CENTER',
  2: 'HORIZONTAL_ALIGNMENT_RIGHT',
  3: 'HORIZONTAL_ALIGNMENT_FILL',
};

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
 * line_edit.cpp:2608-2621: `set_secret_character` does not refuse a literal
 * longer than one character; it `WARN_PRINT`s and truncates it with
 * `c = c.left(1)` (line_edit.cpp:2610-2612). That is the "alters the value"
 * branch of ADR-0032, so out-of-range is an ERROR grounded in the setter, not a
 * hint; `secret_character` carries no `PROPERTY_HINT` at all (line_edit.cpp:3517).
 * An empty literal is legal (length 0 is not `> 1`) and falls back to the
 * bullet at display time (displayText.ts), not at the setter.
 */
const secretCharacterValidator = v.singleCharacter('secret_character', {
  enforced: 'line_edit.cpp:2612',
});

validatorRegistry.registerAll('LineEdit', {
  // -- Ungrouped run (line_edit.cpp:3483-3501) --------------------------------
  // line_edit.cpp:3483 — Variant::STRING, no hint. set_text delegates to
  // _set_text (line_edit.cpp:2130-2131 / 2090-2128), which truncates against
  // max_length — a bound against a SIBLING property, invisible to a per-property
  // validator (see max_length below for the floor it itself enforces).
  text: v.quotedString('text'),
  // line_edit.cpp:3484 — Variant::STRING, no hint. set_placeholder
  // (line_edit.cpp:2257-2266) assigns unconditionally.
  placeholder_text: v.quotedString('placeholder_text'),
  // line_edit.cpp:3485 — PROPERTY_HINT_ENUM "Left,Center,Right,Fill", the 4
  // HorizontalAlignment constants. set_horizontal_alignment (line_edit.cpp:1071-1079)
  // — `ERR_FAIL_INDEX((int)p_alignment, 4)` (line_edit.cpp:1072) — enforced,
  // and this IS the delegate SpinBox's own `alignment` cites for its bound.
  alignment: v.enumInt('alignment', 0, 3, HORIZONTAL_ALIGNMENT, { enforced: 'line_edit.cpp:1072' }),
  // line_edit.cpp:3486 — PROPERTY_HINT_RANGE "0,1000,1,or_greater". set_max_length
  // (line_edit.cpp:2520-2524) — `ERR_FAIL_COND(p_max_length < 0)` (line_edit.cpp:2521)
  // — enforced floor; `or_greater` opens the ceiling.
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

  // -- Virtual Keyboard (ADD_GROUP "Virtual Keyboard", "virtual_keyboard_", --
  // -- line_edit.cpp:3503-3506) -----------------------------------------------
  // line_edit.cpp:3504 — PROPERTY_HINT_GROUP_ENABLE just collapses the group in
  // the inspector; the underlying value is still a plain bool.
  virtual_keyboard_enabled: v.boolean('virtual_keyboard_enabled'),
  virtual_keyboard_show_on_focus: v.boolean('virtual_keyboard_show_on_focus'),
  // line_edit.cpp:3506 — PROPERTY_HINT_ENUM, 8 labels. set_virtual_keyboard_type
  // (line_edit.cpp:2925-2927) assigns unconditionally, no ERR_FAIL.
  virtual_keyboard_type: v.enumInt('virtual_keyboard_type', 0, 7, VIRTUAL_KEYBOARD_TYPE, {
    hinted: 'line_edit.cpp:3506',
  }),

  // -- Caret (ADD_GROUP "Caret", "caret_", line_edit.cpp:3508-3513) -----------
  caret_blink: v.boolean('caret_blink'),
  // line_edit.cpp:3510 hints "0.1,10,0.01", closed both ends.
  // line_edit.cpp:2050, ERR_FAIL_COND(p_interval <= 0): the setter refuses at
  // 0, below the hint's own floor, and assigns anything above it straight
  // through, so (0, 0.1) and everything past 10 warn.
  caret_blink_interval: v.float('caret_blink_interval', {
    enforcedMin: { at: 0, exclusive: true },
    min: 0.1,
    max: 10,
    enforced: { min: 'line_edit.cpp:2050' },
    hinted: 'line_edit.cpp:3510',
  }),
  // line_edit.cpp:3511 — PROPERTY_HINT_RANGE "0,1000,1,or_greater". set_caret_column
  // (line_edit.cpp:2272-2281) clamps below 0 up to 0 (line_edit.cpp:2277-2279) —
  // a clamp is the "alters the value" branch, so the floor is an enforced error.
  // The ceiling clamps to `text.length()`, a bound against a SIBLING property
  // this per-property validator cannot see, so only the floor is checked.
  caret_column: v.int('caret_column', { min: 0, enforced: 'line_edit.cpp:2277' }),
  caret_force_displayed: v.boolean('caret_force_displayed'),
  caret_mid_grapheme: v.boolean('caret_mid_grapheme'),

  // -- Secret (ADD_GROUP "Secret", "secret", line_edit.cpp:3515-3517) ---------
  // line_edit.cpp:3516 — PROPERTY_HINT_GROUP_ENABLE, same collapsing note as
  // virtual_keyboard_enabled above; still a plain bool underneath.
  secret: v.boolean('secret'),
  secret_character: secretCharacterValidator,

  // -- BiDi (ADD_GROUP "BiDi", "", line_edit.cpp:3519-3523) -------------------
  // line_edit.cpp:3520 — PROPERTY_HINT_ENUM "Auto,Left-to-Right,Right-to-Left,Inherited".
  // set_text_direction (line_edit.cpp:2155-2171) —
  // `ERR_FAIL_COND((int)p_text_direction < -1 || (int)p_text_direction > 3)`
  // (line_edit.cpp:2156) — enforced, and -1 is a legacy inherited spelling with
  // no named constant, so it is engine-legal but unlabelled here (same widening
  // TextEdit and Button both make for the identical bound).
  text_direction: v.enumInt('text_direction', -1, 3, TEXT_DIRECTION, {
    enforced: 'line_edit.cpp:2156',
  }),
  // line_edit.cpp:3521 — Variant::STRING, PROPERTY_HINT_LOCALE_ID. set_language
  // (line_edit.cpp:2178-2184) assigns unconditionally.
  language: v.quotedString('language'),
  // line_edit.cpp:3522 — PROPERTY_HINT_ENUM, 7 labels. set_structured_text_bidi_override
  // (line_edit.cpp:2205-2211) assigns unconditionally, no ERR_FAIL.
  structured_text_bidi_override: v.enumInt(
    'structured_text_bidi_override',
    0,
    6,
    STRUCTURED_TEXT_PARSER,
    { hinted: 'line_edit.cpp:3522' }
  ),
  // line_edit.cpp:3523: Variant::ARRAY with no hint, so never written wrapped.
  // The contents are opaque parser-specific arguments with no fixed arity or
  // element type; set_structured_text_bidi_override_options (line_edit.cpp:2217-2220)
  // assigns straight through, leaving only the literal shape to reject.
  structured_text_bidi_override_options: v.arrayLiteral('structured_text_bidi_override_options'),

  // -- Icon (ADD_GROUP "Icon", "", line_edit.cpp:3525-3528) -------------------
  // line_edit.cpp:3526 — Variant::OBJECT, PROPERTY_HINT_RESOURCE_TYPE "Texture2D".
  // set_right_icon (line_edit.cpp:2986-3000) reassigns unconditionally past an
  // identity check; no format Godot enforces beyond "a resource reference".
  right_icon: v.resourceReference('right_icon'),
  // line_edit.cpp:3527 — PROPERTY_HINT_ENUM, 3 labels. set_icon_expand_mode
  // (line_edit.cpp:3010-3019) assigns unconditionally, no ERR_FAIL.
  icon_expand_mode: v.enumInt('icon_expand_mode', 0, 2, EXPAND_MODE, {
    hinted: 'line_edit.cpp:3527',
  }),
  // line_edit.cpp:3528 — PROPERTY_HINT_RANGE "0.1,1.0,0.01", both ends closed
  // (no or_greater/or_less). set_right_icon_scale (line_edit.cpp:3025-3033)
  // assigns unconditionally past an equality check, no ERR_FAIL or clamp.
  right_icon_scale: v.float('right_icon_scale', {
    min: 0.1,
    max: 1.0,
    hinted: 'line_edit.cpp:3528',
  }),
});
