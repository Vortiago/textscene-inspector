/**
 * TextServer enums (`servers/text/text_server.h`) that Godot re-binds on many classes with no
 * common ancestor, so each slice keeps its own bound: TextEdit's hint offers
 * `"Arbitrary:1,Word:2,Word (Smart):3"` while Button's offers `"Off,Arbitrary,Word,Word (Smart)"`.
 */

import { enumNamesByValue } from '../classdb/enumNames.js';

/**
 * `TextServer::AutowrapMode`: AUTOWRAP_OFF=0 … AUTOWRAP_WORD_SMART=3
 * (servers/text/text_server.h:99-102, BIND_ENUM_CONSTANT text_server.cpp:574-577).
 */
export enum AutowrapMode {
  AUTOWRAP_OFF = 0,
  AUTOWRAP_ARBITRARY = 1,
  AUTOWRAP_WORD = 2,
  AUTOWRAP_WORD_SMART = 3,
}

export const AUTOWRAP_MODE_NAMES = enumNamesByValue(AutowrapMode);

/**
 * `TextServer::OverrunBehavior`: OVERRUN_NO_TRIMMING=0 …
 * OVERRUN_TRIM_WORD_ELLIPSIS_FORCE=6 (servers/text/text_server.h:123-130).
 * `FoldableContainer` keeps a narrower local table, since its hint stops at
 * OVERRUN_TRIM_WORD_ELLIPSIS (4).
 */
export enum OverrunBehavior {
  OVERRUN_NO_TRIMMING = 0,
  OVERRUN_TRIM_CHAR = 1,
  OVERRUN_TRIM_WORD = 2,
  OVERRUN_TRIM_ELLIPSIS = 3,
  OVERRUN_TRIM_WORD_ELLIPSIS = 4,
  OVERRUN_TRIM_ELLIPSIS_FORCE = 5,
  OVERRUN_TRIM_WORD_ELLIPSIS_FORCE = 6,
}

export const OVERRUN_BEHAVIOR_NAMES = enumNamesByValue(OverrunBehavior);

/**
 * The `TextServer::JustificationFlag` bits a `justification_flags` hint offers,
 * identical in `label.cpp:1437` and `rich_text_label.cpp:7769`. Not the whole
 * enum: `servers/text/text_server.h:78-88` also declares 4 and 16, which the
 * setters keep but no hint lists, so `hintedBitField` reports them.
 */
export const JUSTIFICATION_HINTED_BITS = {
  1: 'JUSTIFICATION_KASHIDA',
  2: 'JUSTIFICATION_WORD_BOUND',
  8: 'JUSTIFICATION_AFTER_LAST_TAB',
  32: 'JUSTIFICATION_SKIP_LAST_LINE',
  64: 'JUSTIFICATION_SKIP_LAST_LINE_WITH_VISIBLE_CHARS',
  128: 'JUSTIFICATION_DO_NOT_SKIP_SINGLE_LINE',
};

/**
 * `BREAK_TRIM_MASK` (servers/text/text_server.h:120), shared with its bound:
 * all three setters write `x = p_flags & TextServer::BREAK_TRIM_MASK`
 * (`label.cpp:63`, `button.cpp:625`, `rich_text_label.cpp:7390`) with identical
 * hints. Each call site cites its setter as `enforced`.
 */
export const BREAK_TRIM_MASK = 32 | 64 | 128;

/** The three bits `BREAK_TRIM_MASK` keeps (servers/text/text_server.h:116-118). */
export const BREAK_TRIM_LABELS = {
  32: 'BREAK_TRIM_INDENT',
  64: 'BREAK_TRIM_START_EDGE_SPACES',
  128: 'BREAK_TRIM_END_EDGE_SPACES',
};

/**
 * The inspector's flag list, `vformat("Trim Spaces After Break:%d,Trim Spaces
 * Before Break:%d", BREAK_TRIM_START_EDGE_SPACES, BREAK_TRIM_END_EDGE_SPACES)`,
 * so BREAK_TRIM_INDENT warns as unreachable. Not `BREAK_TRIM_MASK & ~32`: this
 * is the hint's own content, and a derived value would hide a hint change.
 */
export const BREAK_TRIM_HINTED_BITS = 64 | 128;

/**
 * `Control::TextDirection`, which aliases `TextServer::Direction`:
 * TEXT_DIRECTION_AUTO=0 … TEXT_DIRECTION_INHERITED=3 (scene/gui/control.h:166-171,
 * BIND_ENUM_CONSTANT control.cpp:4415-4418).
 */
export enum TextDirection {
  TEXT_DIRECTION_AUTO = 0,
  TEXT_DIRECTION_LTR = 1,
  TEXT_DIRECTION_RTL = 2,
  TEXT_DIRECTION_INHERITED = 3,
}

export const TEXT_DIRECTION_NAMES = enumNamesByValue(TextDirection);

/**
 * `TextServer::StructuredTextParser`: STRUCTURED_TEXT_DEFAULT=0 …
 * STRUCTURED_TEXT_CUSTOM=6 (servers/text/text_server.h:214-221). Every hint
 * labels index 5 "None", but the labels follow the enum, so a diagnostic names
 * STRUCTURED_TEXT_GDSCRIPT, as the engine does.
 */
export enum StructuredTextParser {
  STRUCTURED_TEXT_DEFAULT = 0,
  STRUCTURED_TEXT_URI = 1,
  STRUCTURED_TEXT_FILE = 2,
  STRUCTURED_TEXT_EMAIL = 3,
  STRUCTURED_TEXT_LIST = 4,
  STRUCTURED_TEXT_GDSCRIPT = 5,
  STRUCTURED_TEXT_CUSTOM = 6,
}

export const STRUCTURED_TEXT_PARSER_NAMES = enumNamesByValue(StructuredTextParser);
