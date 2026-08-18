/**
 * LinkButton strict validators for linting.
 *
 * Declare only LinkButton's OWN members: the ones doc/classes/LinkButton.xml
 * lists without an `overrides=` attribute. Everything from BaseButton up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * `focus_mode` and `mouse_default_cursor_shape` are skipped: both carry
 * `overrides="Control"` in doc/classes/LinkButton.xml (a default-value override
 * only), and link_button.cpp's `_bind_methods` (link_button.cpp:320-373) never
 * re-declares either with `ADD_PROPERTY`, so both validators belong to Control.
 *
 * LinkButton derives from BaseButton directly (scene/gui/link_button.h:36), not
 * from Button, so it declares its own `text` and its own underline enum instead
 * of inheriting Button's `text`/`alignment`/`icon`.
 */

import '../basebutton/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import {
  OVERRUN_BEHAVIOR,
  STRUCTURED_TEXT_PARSER,
  TEXT_DIRECTION,
} from '../../../../linter/validators/textServerEnums.js';

const UNDERLINE_MODE = {
  0: 'UNDERLINE_MODE_ALWAYS',
  1: 'UNDERLINE_MODE_ON_HOVER',
  2: 'UNDERLINE_MODE_NEVER',
};

/**
 * link_button.cpp:91-108: `set_ellipsis_char` does not refuse a literal
 * longer than one character; it `WARN_PRINT`s and clamps it with
 * `c = c.left(1)` (link_button.cpp:93-96), so a longer value is silently
 * altered rather than rejected. That is the "alters the value" branch of
 * ADR-0032, so out-of-range is an ERROR grounded in the setter, not a hint;
 * `ellipsis_char` carries no `PROPERTY_HINT` at all (link_button.cpp:350).
 */
const ellipsisCharValidator = v.singleCharacter('ellipsis_char', {
  enforced: 'link_button.cpp:93',
});

validatorRegistry.registerAll('LinkButton', {
  // link_button.cpp:344: Variant::STRING, no hint. set_text (link_button.cpp:55-64)
  // assigns unconditionally, no length limit.
  text: v.quotedString('text'),
  // link_button.cpp:346: Variant::STRING, no hint. set_uri (link_button.cpp:153-158)
  // assigns unconditionally; any string is a candidate URI, opened at runtime
  // via OS.shell_open, never validated by the setter.
  uri: v.quotedString('uri'),
  // link_button.cpp:345: PROPERTY_HINT_ENUM "Always,On Hover,Never", 3 labels
  // matching LinkButton::UnderlineMode exactly (link_button.h:40-44).
  // set_underline_mode (link_button.cpp:164-175) assigns unconditionally, no
  // ERR_FAIL.
  underline: v.enumInt('underline', 0, 2, UNDERLINE_MODE, { hinted: 'link_button.cpp:345' }),
  ellipsis_char: ellipsisCharValidator,
  // link_button.cpp:349: PROPERTY_HINT_ENUM with 7 entries; TextServer::OverrunBehavior
  // OVERRUN_NO_TRIMMING=0 .. OVERRUN_TRIM_WORD_ELLIPSIS_FORCE=6
  // (servers/text/text_server.h:123-130). set_text_overrun_behavior
  // (link_button.cpp:70-77) assigns unconditionally, no ERR_FAIL.
  text_overrun_behavior: v.enumInt('text_overrun_behavior', 0, 6, OVERRUN_BEHAVIOR, {
    hinted: 'link_button.cpp:349',
  }),
  // link_button.cpp:353: PROPERTY_HINT_ENUM "Auto,Left-to-Right,Right-to-Left,Inherited".
  // set_text_direction (link_button.cpp:128-135):
  // `ERR_FAIL_COND((int)p_text_direction < -1 || (int)p_text_direction > 3)`,
  // the same bound Button's own text_direction setter enforces (button.cpp:637),
  // so -1 is engine-legal even though the hint does not name it.
  text_direction: v.enumInt('text_direction', -1, 3, TEXT_DIRECTION, {
    enforced: 'link_button.cpp:129',
  }),
  // link_button.cpp:354: PROPERTY_HINT_LOCALE_ID; any locale string parses.
  // set_language (link_button.cpp:141-151) assigns unconditionally.
  language: v.quotedString('language'),
  // link_button.cpp:355: PROPERTY_HINT_ENUM "Default,URI,File,Email,List,None,Custom";
  // BIND_ENUM_CONSTANT STRUCTURED_TEXT_DEFAULT=0 .. STRUCTURED_TEXT_CUSTOM=6
  // (servers/text/text_server.cpp:681-687, enum declared text_server.h:214-222).
  // The hint labels index 5 "None"; the real constant is STRUCTURED_TEXT_GDSCRIPT.
  // set_structured_text_bidi_override (link_button.cpp:83-89) assigns
  // unconditionally, no ERR_FAIL.
  structured_text_bidi_override: v.enumInt(
    'structured_text_bidi_override',
    0,
    6,
    STRUCTURED_TEXT_PARSER,
    { hinted: 'link_button.cpp:355' }
  ),
  // link_button.cpp:356: Variant::ARRAY with no hint, so never written wrapped.
  // set_structured_text_bidi_override_options (link_button.cpp:118-122) assigns
  // straight through, leaving only the literal shape to reject.
  structured_text_bidi_override_options: v.arrayLiteral('structured_text_bidi_override_options'),
});
