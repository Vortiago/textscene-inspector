/**
 * LinkButton's strict validators: only the members doc/classes/LinkButton.xml lists without `overrides=`,
 * since the NODE_BASE_TYPES base-walk delivers BaseButton's and a re-declared key duplicates the rule.
 * `focus_mode` and `mouse_default_cursor_shape` override only a default, and link_button.cpp's `_bind_methods`
 * (link_button.cpp:320-373) never re-declares them. LinkButton derives from BaseButton (scene/gui/link_button.h:36), not Button.
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
 * link_button.cpp:91-108: `set_ellipsis_char` truncates a longer literal with `c = c.left(1)`
 * (link_button.cpp:93-96) after a `WARN_PRINT`. It alters the value, so this errors (ADR-0032). The
 * property has no `PROPERTY_HINT` (link_button.cpp:350).
 */
const ellipsisCharValidator = v.singleCharacter('ellipsis_char', {
  enforced: 'link_button.cpp:93',
});

validatorRegistry.registerAll('LinkButton', {
  // link_button.cpp:344, no hint. set_text (link_button.cpp:55-64) assigns unconditionally, with no length limit.
  text: v.quotedString('text'),
  // link_button.cpp:346, no hint. set_uri (link_button.cpp:153-158) assigns unconditionally: any string
  // is a candidate URI, opened at runtime through OS.shell_open.
  uri: v.quotedString('uri'),
  // link_button.cpp:345: PROPERTY_HINT_ENUM "Always,On Hover,Never", LinkButton::UnderlineMode
  // (link_button.h:40-44). set_underline_mode (link_button.cpp:164-175) assigns unconditionally.
  underline: v.enumInt('underline', 0, 2, UNDERLINE_MODE, { hinted: 'link_button.cpp:345' }),
  ellipsis_char: ellipsisCharValidator,
  // link_button.cpp:349: PROPERTY_HINT_ENUM, 7 entries, TextServer::OverrunBehavior 0 .. 6
  // (servers/text/text_server.h:123-130). set_text_overrun_behavior (link_button.cpp:70-77) assigns
  // unconditionally.
  text_overrun_behavior: v.enumInt('text_overrun_behavior', 0, 6, OVERRUN_BEHAVIOR, {
    hinted: 'link_button.cpp:349',
  }),
  // link_button.cpp:353: PROPERTY_HINT_ENUM "Auto,Left-to-Right,Right-to-Left,Inherited". set_text_direction
  // (link_button.cpp:128-135) enforces `ERR_FAIL_COND((int)p_text_direction < -1 || (int)p_text_direction > 3)`,
  // as Button does (button.cpp:637), so -1 is legal although the hint does not name it.
  text_direction: v.enumInt('text_direction', 0, 3, TEXT_DIRECTION, {
    hinted: 'link_button.cpp:353',
    enforced: 'link_button.cpp:129',
    enforcedMin: { at: -1 },
  }),
  // link_button.cpp:354: PROPERTY_HINT_LOCALE_ID. set_language (link_button.cpp:141-151) assigns unconditionally.
  language: v.quotedString('language'),
  // link_button.cpp:355: PROPERTY_HINT_ENUM "Default,URI,File,Email,List,None,Custom" over STRUCTURED_TEXT_*
  // 0 .. 6 (servers/text/text_server.cpp:681-687, text_server.h:214-222). The hint labels index 5 "None",
  // but the constant is STRUCTURED_TEXT_GDSCRIPT. set_structured_text_bidi_override
  // (link_button.cpp:83-89) assigns unconditionally.
  structured_text_bidi_override: v.enumInt(
    'structured_text_bidi_override',
    0,
    6,
    STRUCTURED_TEXT_PARSER,
    { hinted: 'link_button.cpp:355' }
  ),
  // link_button.cpp:356: an ARRAY with no hint, so never written wrapped.
  // set_structured_text_bidi_override_options (link_button.cpp:118-122) assigns straight through, so
  // only the literal shape is checked.
  structured_text_bidi_override_options: v.arrayLiteral('structured_text_bidi_override_options'),
});
