/**
 * TextServer enums (`servers/text/text_server.h`) that Godot re-binds on many classes with no
 * common ancestor, so each slice keeps its own bound: TextEdit's hint offers
 * `"Arbitrary:1,Word:2,Word (Smart):3"` while Button's offers `"Off,Arbitrary,Word,Word (Smart)"`.
 */

import { enumNamesByValue, flagLabels } from '../classdb/enumNames.js';

/**
 * `TextServer::AutowrapMode`: AUTOWRAP_OFF=0 … AUTOWRAP_WORD_SMART=3
 * (servers/text/text_server.h:99-102, BIND_ENUM_CONSTANT text_server.cpp:574-577).
 */
export const AutowrapMode = {
  AUTOWRAP_OFF: 0,
  AUTOWRAP_ARBITRARY: 1,
  AUTOWRAP_WORD: 2,
  AUTOWRAP_WORD_SMART: 3,
} as const;

export const AUTOWRAP_MODE_NAMES = enumNamesByValue(AutowrapMode);

/**
 * `TextServer::OverrunBehavior`: OVERRUN_NO_TRIMMING=0 …
 * OVERRUN_TRIM_WORD_ELLIPSIS_FORCE=6 (servers/text/text_server.h:123-130).
 * `FoldableContainer`'s hint stops at OVERRUN_TRIM_WORD_ELLIPSIS (4).
 */
export const OverrunBehavior = {
  OVERRUN_NO_TRIMMING: 0,
  OVERRUN_TRIM_CHAR: 1,
  OVERRUN_TRIM_WORD: 2,
  OVERRUN_TRIM_ELLIPSIS: 3,
  OVERRUN_TRIM_WORD_ELLIPSIS: 4,
  OVERRUN_TRIM_ELLIPSIS_FORCE: 5,
  OVERRUN_TRIM_WORD_ELLIPSIS_FORCE: 6,
} as const;

export const OVERRUN_BEHAVIOR_NAMES = enumNamesByValue(OverrunBehavior);

/**
 * `TextServer::JustificationFlag` (`servers/text/text_server.h:78-88`), each member without
 * `JUSTIFICATION_`.
 */
export const JustificationFlag = {
  NONE: 0,
  KASHIDA: 1 << 0,
  WORD_BOUND: 1 << 1,
  TRIM_EDGE_SPACES: 1 << 2,
  AFTER_LAST_TAB: 1 << 3,
  CONSTRAIN_ELLIPSIS: 1 << 4,
  SKIP_LAST_LINE: 1 << 5,
  SKIP_LAST_LINE_WITH_VISIBLE_CHARS: 1 << 6,
  DO_NOT_SKIP_SINGLE_LINE: 1 << 7,
} as const;

/**
 * The `JustificationFlag` bits a `justification_flags` hint offers, identical in `label.cpp:1437`
 * and `rich_text_label.cpp:7769`. Not the whole enum: `TRIM_EDGE_SPACES` (4) and
 * `CONSTRAIN_ELLIPSIS` (16) are ones the setters keep but no hint lists, so `hintedBitField`
 * reports them.
 */
export const JUSTIFICATION_HINTED_NAMES = flagLabels(JustificationFlag, 'JUSTIFICATION_', [
  'KASHIDA',
  'WORD_BOUND',
  'AFTER_LAST_TAB',
  'SKIP_LAST_LINE',
  'SKIP_LAST_LINE_WITH_VISIBLE_CHARS',
  'DO_NOT_SKIP_SINGLE_LINE',
]);

/**
 * `TextServer::LineBreakFlag` (`servers/text/text_server.h:105-121`), each member without `BREAK_`.
 * The deprecated `BREAK_TRIM_EDGE_SPACES` (1 << 4) is left out, as `BREAK_TRIM_MASK` omits it.
 */
export const LineBreakFlag = {
  NONE: 0,
  MANDATORY: 1 << 0,
  WORD_BOUND: 1 << 1,
  GRAPHEME_BOUND: 1 << 2,
  ADAPTIVE: 1 << 3,
  TRIM_INDENT: 1 << 5,
  TRIM_START_EDGE_SPACES: 1 << 6,
  TRIM_END_EDGE_SPACES: 1 << 7,
} as const;

/**
 * `BREAK_TRIM_MASK` (servers/text/text_server.h:120), shared with its bound:
 * all three setters write `x = p_flags & TextServer::BREAK_TRIM_MASK`
 * (`label.cpp:63`, `button.cpp:625`, `rich_text_label.cpp:7390`) with identical
 * hints. Each call site cites its setter as `enforced`.
 */
export const BREAK_TRIM_MASK =
  LineBreakFlag.TRIM_INDENT | LineBreakFlag.TRIM_START_EDGE_SPACES | LineBreakFlag.TRIM_END_EDGE_SPACES;

/** The three bits `BREAK_TRIM_MASK` keeps (servers/text/text_server.h:116-118). */
export const BREAK_TRIM_NAMES = flagLabels(LineBreakFlag, 'BREAK_', [
  'TRIM_INDENT',
  'TRIM_START_EDGE_SPACES',
  'TRIM_END_EDGE_SPACES',
]);

/**
 * The inspector's flag list, `vformat("Trim Spaces After Break:%d,Trim Spaces
 * Before Break:%d", BREAK_TRIM_START_EDGE_SPACES, BREAK_TRIM_END_EDGE_SPACES)`,
 * so BREAK_TRIM_INDENT warns as unreachable. Not `BREAK_TRIM_MASK & ~32`: this
 * is the hint's own content, and a derived value would hide a hint change.
 */
export const BREAK_TRIM_HINTED_BITS =
  LineBreakFlag.TRIM_START_EDGE_SPACES | LineBreakFlag.TRIM_END_EDGE_SPACES;

/**
 * `Control::TextDirection`, which aliases `TextServer::Direction`:
 * TEXT_DIRECTION_AUTO=0 … TEXT_DIRECTION_INHERITED=3 (scene/gui/control.h:166-171,
 * BIND_ENUM_CONSTANT control.cpp:4415-4418).
 */
export const TextDirection = {
  TEXT_DIRECTION_AUTO: 0,
  TEXT_DIRECTION_LTR: 1,
  TEXT_DIRECTION_RTL: 2,
  TEXT_DIRECTION_INHERITED: 3,
} as const;

export const TEXT_DIRECTION_NAMES = enumNamesByValue(TextDirection);

/**
 * `TextServer::VisibleCharactersBehavior` (`servers/text/text_server.h:90-96`), hinted with five
 * entries at `label.cpp:1451` and `rich_text_label.cpp:7789`. Label's default is `VC_CHARS_BEFORE_SHAPING` (`label.h:74`).
 */
export const VisibleCharactersBehavior = {
  VC_CHARS_BEFORE_SHAPING: 0,
  VC_CHARS_AFTER_SHAPING: 1,
  VC_GLYPHS_AUTO: 2,
  VC_GLYPHS_LTR: 3,
  VC_GLYPHS_RTL: 4,
} as const;

export const VISIBLE_CHARACTERS_BEHAVIOR_NAMES = enumNamesByValue(VisibleCharactersBehavior);

/**
 * `TextServer::StructuredTextParser`: STRUCTURED_TEXT_DEFAULT=0 …
 * STRUCTURED_TEXT_CUSTOM=6 (servers/text/text_server.h:214-221). Every hint
 * labels index 5 "None", but the labels follow the enum, so a diagnostic names
 * STRUCTURED_TEXT_GDSCRIPT, as the engine does.
 */
const StructuredTextParser = {
  STRUCTURED_TEXT_DEFAULT: 0,
  STRUCTURED_TEXT_URI: 1,
  STRUCTURED_TEXT_FILE: 2,
  STRUCTURED_TEXT_EMAIL: 3,
  STRUCTURED_TEXT_LIST: 4,
  STRUCTURED_TEXT_GDSCRIPT: 5,
  STRUCTURED_TEXT_CUSTOM: 6,
} as const;

export const STRUCTURED_TEXT_PARSER_NAMES = enumNamesByValue(StructuredTextParser);
