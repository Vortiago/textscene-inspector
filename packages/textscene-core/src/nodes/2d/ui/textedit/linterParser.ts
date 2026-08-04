/**
 * TextEdit strict validators for linting.
 *
 * Declare only TextEdit's OWN members — the ones doc/classes/TextEdit.xml
 * lists without an `overrides=` attribute. Everything from Control up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * `focus_mode` and `mouse_default_cursor_shape` are skipped: doc/classes/TextEdit.xml
 * marks both `overrides="Control"` — text_edit.cpp never re-declares either with
 * ADD_PROPERTY (its `_bind_methods` only carries TextEdit's own 47 members,
 * text_edit.cpp:7545-7608), so both validators belong to Control and would
 * duplicate the rule here.
 *
 * Grouped to match the ADD_GROUP structure text_edit.cpp:7545-7608 actually
 * uses: an ungrouped run of text/behaviour/wrap properties, then Virtual
 * Keyboard, Scroll, Minimap, Caret, Word Separators, Highlighting, Visual
 * Whitespace, and BiDi.
 */

import '../../../2d/ui/control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { accepts, propertyError, v } from '../../../../linter/validators/index.js';
import { AUTOWRAP_MODE, TEXT_DIRECTION } from '../../../../linter/validators/textServerEnums.js';

/**
 * `structured_text_bidi_override_options` is a plain Godot `Array`
 * (doc/classes/TextEdit.xml:1400, default `[]`) whose contents are opaque,
 * parser-specific arguments interpreted by whichever `structured_text_bidi_override`
 * parser is active — there is no fixed arity or element type to check, only
 * the TSCN variant-text bracket grammar the parser layer already relies on
 * (parser/utils.ts's heading/array bracket checks use the same `[...]` shape).
 */
const ARRAY_LITERAL_RE = /^\[[\s\S]*\]$/;

validatorRegistry.registerAll('TextEdit', {
  // Text & behaviour (ungrouped run, text_edit.cpp:7545-7561).
  // text_edit.cpp:7545 — Variant::STRING, PROPERTY_HINT_MULTILINE_TEXT.
  text: v.quotedString('text'),
  // text_edit.cpp:7546 — Variant::STRING, PROPERTY_HINT_MULTILINE_TEXT.
  placeholder_text: v.quotedString('placeholder_text'),
  // text_edit.cpp:7548
  editable: v.boolean('editable'),
  // text_edit.cpp:7549
  context_menu_enabled: v.boolean('context_menu_enabled'),
  // text_edit.cpp:7550
  emoji_menu_enabled: v.boolean('emoji_menu_enabled'),
  // text_edit.cpp:7551
  backspace_deletes_composite_character_enabled: v.boolean(
    'backspace_deletes_composite_character_enabled'
  ),
  // text_edit.cpp:7552
  shortcut_keys_enabled: v.boolean('shortcut_keys_enabled'),
  // text_edit.cpp:7553
  selecting_enabled: v.boolean('selecting_enabled'),
  // text_edit.cpp:7554
  deselect_on_focus_loss_enabled: v.boolean('deselect_on_focus_loss_enabled'),
  // text_edit.cpp:7555
  drag_and_drop_selection_enabled: v.boolean('drag_and_drop_selection_enabled'),
  // text_edit.cpp:7556
  middle_mouse_paste_enabled: v.boolean('middle_mouse_paste_enabled'),
  // text_edit.cpp:7557
  empty_selection_clipboard_enabled: v.boolean('empty_selection_clipboard_enabled'),
  // text_edit.cpp:7558 — PROPERTY_HINT_ENUM "None,Boundary"; BIND_ENUM_CONSTANT
  // LINE_WRAPPING_NONE=0, LINE_WRAPPING_BOUNDARY=1 (text_edit.cpp:7402-7403,
  // enum declared text_edit.h:68-71). set_line_wrapping_mode (text_edit.cpp:6341-6351)
  // assigns unconditionally, no ERR_FAIL.
  wrap_mode: v.enumInt(
    'wrap_mode',
    0,
    1,
    {
      0: 'LINE_WRAPPING_NONE',
      1: 'LINE_WRAPPING_BOUNDARY',
    },
    { hinted: 'text_edit.cpp:7558' }
  ),
  // text_edit.cpp:7559 — PROPERTY_HINT_ENUM "Arbitrary:1,Word:2,Word (Smart):3"
  // only offers 1-3 in the editor dropdown, but the underlying
  // TextServer::AutowrapMode enum starts at AUTOWRAP_OFF=0 (servers/text/text_server.h:98-102,
  // BIND_ENUM_CONSTANT text_server.cpp:574-577), and TextEdit::set_autowrap_mode
  // has no CLAMP or ERR_FAIL on the value (text_edit.cpp:6354-6360) — same call
  // as BaseButton's button_mask: an editor-hint width is an authoring aid, not
  // a validity bound, so 0 is accepted alongside the 3 offered values.
  autowrap_mode: v.enumInt('autowrap_mode', 0, 3, AUTOWRAP_MODE, { hinted: 'text_edit.cpp:7559' }),
  // text_edit.cpp:7560
  indent_wrapped_lines: v.boolean('indent_wrapped_lines'),
  // text_edit.cpp:7561
  tab_input_mode: v.boolean('tab_input_mode'),

  // Virtual Keyboard (ADD_GROUP "Virtual Keyboard", text_edit.cpp:7563-7565).
  virtual_keyboard_enabled: v.boolean('virtual_keyboard_enabled'),
  virtual_keyboard_show_on_focus: v.boolean('virtual_keyboard_show_on_focus'),

  // Scroll (ADD_GROUP "Scroll", text_edit.cpp:7567-7574).
  scroll_smooth: v.boolean('scroll_smooth'),
  // text_edit.cpp:7569 — TextEdit::set_v_scroll_speed ERR_FAIL_COND(p_speed < 1.0)
  // (text_edit.cpp:6490): a real file can never carry a value below 1.
  scroll_v_scroll_speed: v.float('scroll_v_scroll_speed', { min: 1, enforced: 'text_edit.cpp:6490' }),
  scroll_past_end_of_file: v.boolean('scroll_past_end_of_file'),
  // text_edit.cpp:7571 — TextEdit::set_v_scroll (text_edit.cpp:6463-6470) itself
  // has no guard; it forwards to the internal VScrollBar's Range::set_value.
  // The guard is in Range::_calc_value's `if (!shared->allow_lesser && p_val <
  // shared->min) { p_val = shared->min; }` (scene/gui/range.cpp:196), and
  // TextEdit never touches that VScrollBar's `min`/`allow_lesser`, so the
  // defaults (min=0.0, allow_lesser=false, scene/gui/range.h:40,46) clamp any
  // lesser value back up before it could ever be saved.
  scroll_vertical: v.float('scroll_vertical', { min: 0, enforced: 'range.cpp:196' }),
  // text_edit.cpp:7572 — TextEdit::set_h_scroll clamps p_scroll < 0 to 0
  // in-place (text_edit.cpp:6477-6479), so a saved scene never carries a
  // negative value.
  scroll_horizontal: v.int('scroll_horizontal', { min: 0, enforced: 'text_edit.cpp:6477' }),
  scroll_fit_content_height: v.boolean('scroll_fit_content_height'),
  scroll_fit_content_width: v.boolean('scroll_fit_content_width'),

  // Minimap (ADD_GROUP "Minimap", text_edit.cpp:7576-7578).
  minimap_draw: v.boolean('minimap_draw'),
  // text_edit.cpp:7578 — TextEdit::set_minimap_width (text_edit.cpp:6690-6696)
  // stores the int with no clamp or ERR_FAIL, so any integer is engine-valid.
  minimap_width: v.int('minimap_width'),

  // Caret (ADD_GROUP "Caret", text_edit.cpp:7580-7587).
  // text_edit.cpp:7581 — PROPERTY_HINT_ENUM "Line,Block"; BIND_ENUM_CONSTANT
  // CARET_TYPE_LINE=0, CARET_TYPE_BLOCK=1 (text_edit.cpp:7293-7294, enum
  // declared text_edit.h:53-56). set_caret_type (text_edit.cpp:5159-5166)
  // assigns unconditionally, no ERR_FAIL.
  caret_type: v.enumInt(
    'caret_type',
    0,
    1,
    {
      0: 'CARET_TYPE_LINE',
      1: 'CARET_TYPE_BLOCK',
    },
    { hinted: 'text_edit.cpp:7581' }
  ),
  caret_blink: v.boolean('caret_blink'),
  // text_edit.cpp:7583 — PROPERTY_HINT_RANGE "0.1,10,0.01,suffix:s" is the
  // editor slider only; TextEdit::set_caret_blink_interval enforces just
  // `ERR_FAIL_COND(p_interval <= 0)` (text_edit.cpp:5198), so any positive
  // float is engine-valid even past the slider's 10 ceiling. Deliberately
  // wider than the hint: do not "correct" this toward 0.1-10.
  caret_blink_interval: v.positiveFloat('caret_blink_interval', undefined, {
    enforced: 'text_edit.cpp:5198',
  }),
  caret_draw_when_editable_disabled: v.boolean('caret_draw_when_editable_disabled'),
  caret_move_on_right_click: v.boolean('caret_move_on_right_click'),
  caret_mid_grapheme: v.boolean('caret_mid_grapheme'),
  caret_multiple: v.boolean('caret_multiple'),

  // Word Separators (ADD_GROUP "Word Separators", "", text_edit.cpp:7589-7592).
  use_default_word_separators: v.boolean('use_default_word_separators'),
  use_custom_word_separators: v.boolean('use_custom_word_separators'),
  // text_edit.cpp:7592 — Variant::STRING, no MULTILINE hint.
  custom_word_separators: v.quotedString('custom_word_separators'),

  // Highlighting (ADD_GROUP "Highlighting", "", text_edit.cpp:7594-7597).
  // text_edit.cpp:7595 — Variant::OBJECT, PROPERTY_HINT_RESOURCE_TYPE "SyntaxHighlighter".
  syntax_highlighter: v.resourceReference('syntax_highlighter'),
  highlight_all_occurrences: v.boolean('highlight_all_occurrences'),
  highlight_current_line: v.boolean('highlight_current_line'),

  // Visual Whitespace (ADD_GROUP "Visual Whitespace", "draw_", text_edit.cpp:7599-7602).
  draw_control_chars: v.boolean('draw_control_chars'),
  draw_tabs: v.boolean('draw_tabs'),
  draw_spaces: v.boolean('draw_spaces'),

  // BiDi (ADD_GROUP "BiDi", "", text_edit.cpp:7604-7608).
  // text_edit.cpp:7605 — PROPERTY_HINT_ENUM "Auto,Left-to-Right,Right-to-Left,Inherited";
  // BIND_ENUM_CONSTANT TEXT_DIRECTION_AUTO=0, _LTR=1, _RTL=2, _INHERITED=3
  // (scene/gui/control.cpp:4415-4418, enum declared control.h:166-171, mirroring
  // TextServer::Direction servers/text/text_server.h:66-71). set_text_direction
  // (text_edit.cpp:3724): `ERR_FAIL_COND((int)p_text_direction < -1 || > 3)` —
  // enforced, and -1 is a legacy inherited spelling with no named constant, so
  // it is engine-legal but unlabelled here. Widened from 0-3 to include it.
  text_direction: v.enumInt('text_direction', -1, 3, TEXT_DIRECTION, {
    enforced: 'text_edit.cpp:3724',
  }),
  // text_edit.cpp:7606 — Variant::STRING, PROPERTY_HINT_LOCALE_ID.
  language: v.quotedString('language'),
  // text_edit.cpp:7607 — PROPERTY_HINT_ENUM "Default,URI,File,Email,List,None,Custom";
  // BIND_ENUM_CONSTANT STRUCTURED_TEXT_DEFAULT=0 .. STRUCTURED_TEXT_CUSTOM=6
  // (servers/text/text_server.cpp:681-687, enum declared text_server.h:214-222).
  // The hint labels index 5 "None"; the real constant is STRUCTURED_TEXT_GDSCRIPT.
  // set_structured_text_bidi_override (text_edit.cpp:3778-3786) assigns
  // unconditionally, no ERR_FAIL.
  structured_text_bidi_override: v.enumInt('structured_text_bidi_override', 0, 6, {
    0: 'STRUCTURED_TEXT_DEFAULT',
    1: 'STRUCTURED_TEXT_URI',
    2: 'STRUCTURED_TEXT_FILE',
    3: 'STRUCTURED_TEXT_EMAIL',
    4: 'STRUCTURED_TEXT_LIST',
    5: 'STRUCTURED_TEXT_GDSCRIPT',
    6: 'STRUCTURED_TEXT_CUSTOM',
  }, { hinted: 'text_edit.cpp:7607' }),
  // text_edit.cpp:7608 — Variant::ARRAY, default "[]"; see ARRAY_LITERAL_RE above.
  structured_text_bidi_override_options: accepts((key, value, line) => {
    if (!ARRAY_LITERAL_RE.test(value)) {
      return propertyError(
        key,
        line,
        `Property 'structured_text_bidi_override_options' must be an Array literal like [], got: ${value}`,
        'INVALID_STRUCTURED_TEXT_BIDI_OVERRIDE_OPTIONS_FORMAT'
      );
    }
    return null;
  }, 'Array literal ([...])'),
});
