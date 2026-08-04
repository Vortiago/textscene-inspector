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
import { propertyError, v } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { TEXT_DIRECTION } from '../../../../linter/validators/textServerEnums.js';

const UNDERLINE_MODE = {
  0: 'UNDERLINE_MODE_ALWAYS',
  1: 'UNDERLINE_MODE_ON_HOVER',
  2: 'UNDERLINE_MODE_NEVER',
};

const OVERRUN_BEHAVIOR = {
  0: 'OVERRUN_NO_TRIMMING',
  1: 'OVERRUN_TRIM_CHAR',
  2: 'OVERRUN_TRIM_WORD',
  3: 'OVERRUN_TRIM_ELLIPSIS',
  4: 'OVERRUN_TRIM_WORD_ELLIPSIS',
  5: 'OVERRUN_TRIM_ELLIPSIS_FORCE',
  6: 'OVERRUN_TRIM_WORD_ELLIPSIS_FORCE',
};

const STRUCTURED_TEXT_PARSER = {
  0: 'STRUCTURED_TEXT_DEFAULT',
  1: 'STRUCTURED_TEXT_URI',
  2: 'STRUCTURED_TEXT_FILE',
  3: 'STRUCTURED_TEXT_EMAIL',
  4: 'STRUCTURED_TEXT_LIST',
  5: 'STRUCTURED_TEXT_GDSCRIPT',
  6: 'STRUCTURED_TEXT_CUSTOM',
};

/**
 * A quoted TSCN string literal. Checked locally rather than through
 * `v.quotedString` because `ellipsis_char` needs the unquoted body to measure
 * its length.
 */
const QUOTED_RE = /^"(?:[^"\\]|\\[\s\S])*"$/;

/**
 * link_button.cpp:91-108: `set_ellipsis_char` does not refuse a literal
 * longer than one character; it `WARN_PRINT`s and clamps it with
 * `c = c.left(1)` (link_button.cpp:93-96), so a longer value is silently
 * altered rather than rejected. That is the "alters the value" branch of
 * ADR-0032, so out-of-range is an ERROR grounded in the setter, not a hint;
 * `ellipsis_char` carries no `PROPERTY_HINT` at all (link_button.cpp:350).
 */
const ellipsisCharValidator: PropertyValidator = (key, value, line) => {
  if (!QUOTED_RE.test(value)) {
    return propertyError(
      key,
      line,
      `Property 'ellipsis_char' must be a quoted string, got: ${value}`,
      'INVALID_ELLIPSIS_CHAR_FORMAT'
    );
  }
  const body = value.slice(1, -1).replace(/\\"/g, '"');
  if (body.length > 1) {
    return propertyError(
      key,
      line,
      `Property 'ellipsis_char' must be exactly one character, got ${body.length} characters: "${body}"`,
      'INVALID_ELLIPSIS_CHAR_VALUE'
    );
  }
  return null;
};
ellipsisCharValidator.accepts = 'quoted string, at most one character';
ellipsisCharValidator.bounded = true;
ellipsisCharValidator.grounding = { kind: 'enforced', cite: 'link_button.cpp:93' };

/**
 * `structured_text_bidi_override_options` is a plain Godot `Array`
 * (doc/classes/LinkButton.xml:24, default `[]`); its `ADD_PROPERTY`
 * (link_button.cpp:356) carries no hint at all, and
 * `set_structured_text_bidi_override_options` (link_button.cpp:118-122) assigns
 * the Array straight through, so this only rejects a malformed literal.
 */
const ARRAY_LITERAL_RE = /^\[[\s\S]*\]$/;
const structuredTextBidiOverrideOptionsValidator: PropertyValidator = (key, value, line) => {
  if (!ARRAY_LITERAL_RE.test(value)) {
    return propertyError(
      key,
      line,
      `Property 'structured_text_bidi_override_options' must be an Array literal like [], got: ${value}`,
      'INVALID_STRUCTURED_TEXT_BIDI_OVERRIDE_OPTIONS_FORMAT'
    );
  }
  return null;
};
structuredTextBidiOverrideOptionsValidator.accepts = 'Array literal ([...])';
structuredTextBidiOverrideOptionsValidator.formatOnly = true;

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
  // link_button.cpp:356: Variant::ARRAY, default "[]"; see ARRAY_LITERAL_RE above.
  structured_text_bidi_override_options: structuredTextBidiOverrideOptionsValidator,
});
