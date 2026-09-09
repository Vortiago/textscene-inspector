/**
 * TextServer enums that Godot re-binds on every text-bearing Control.
 *
 * `Button` and `TextEdit` both spell these out today, and `Label`,
 * `RichTextLabel` and `LineEdit` each bind the same keys in later waves. Godot
 * declares them once on the server (`servers/text/text_server.h`) and every
 * class re-declares the property, so there is no common ancestor to hoist the
 * validator onto: only the label table is shared. The same argument
 * `containerAlignment.ts` makes for the container family.
 *
 * The BOUND stays with each slice. It is not a property of the enum: TextEdit's
 * hint offers `"Arbitrary:1,Word:2,Word (Smart):3"` while Button's offers
 * `"Off,Arbitrary,Word,Word (Smart)"`, and each slice cites why it lands where
 * it does.
 */

/**
 * `TextServer::AutowrapMode` — AUTOWRAP_OFF=0 … AUTOWRAP_WORD_SMART=3
 * (servers/text/text_server.h:99-102, BIND_ENUM_CONSTANT text_server.cpp:574-577).
 */
export const AUTOWRAP_MODE = {
  0: 'AUTOWRAP_OFF',
  1: 'AUTOWRAP_ARBITRARY',
  2: 'AUTOWRAP_WORD',
  3: 'AUTOWRAP_WORD_SMART',
} as const;

/**
 * `TextServer::OverrunBehavior` — OVERRUN_NO_TRIMMING=0 …
 * OVERRUN_TRIM_WORD_ELLIPSIS_FORCE=6 (servers/text/text_server.h:123-130).
 *
 * Four slices bind all seven and had byte-identical copies: Button, Label,
 * LinkButton and ItemList. `FoldableContainer` deliberately does NOT use this
 * table — its hint stops at OVERRUN_TRIM_WORD_ELLIPSIS (4), so it keeps a
 * narrower local one and widening it here would loosen a real bound.
 *
 * As everywhere in this file the BOUND stays at the call site: each class hints
 * its own list and cites its own ADD_PROPERTY line.
 */
export const OVERRUN_BEHAVIOR = {
  0: 'OVERRUN_NO_TRIMMING',
  1: 'OVERRUN_TRIM_CHAR',
  2: 'OVERRUN_TRIM_WORD',
  3: 'OVERRUN_TRIM_ELLIPSIS',
  4: 'OVERRUN_TRIM_WORD_ELLIPSIS',
  5: 'OVERRUN_TRIM_ELLIPSIS_FORCE',
  6: 'OVERRUN_TRIM_WORD_ELLIPSIS_FORCE',
};

/**
 * The `TextServer::JustificationFlag` bits a `justification_flags` hint OFFERS.
 *
 * Deliberately NOT the whole enum. `servers/text/text_server.h:78-88` also
 * declares `JUSTIFICATION_TRIM_EDGE_SPACES = 4` and
 * `JUSTIFICATION_CONSTRAIN_ELLIPSIS = 16`, which the setters keep unaltered but
 * no hint lists, so they are the values `hintedBitField` reports. Label and
 * RichTextLabel hint byte-identical strings (`label.cpp:1437`,
 * `rich_text_label.cpp:7769`), which is what makes this shared data rather than
 * a coincidence; each call site still cites its own line.
 *
 * Note the set is SPARSE (4 and 16 missing), so no min/max bound can express it.
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
 * `TextServer::LineBreakFlag`'s trim bits, as `autowrap_trim_flags` uses them.
 *
 * Unusually for this file the BOUND is shared too, not just the labels, and the
 * reason is that there is no per-class bound to differ: all three setters mask
 * with the same named engine constant (`x = p_flags &
 * TextServer::BREAK_TRIM_MASK` at `label.cpp:63`, `button.cpp:625`,
 * `rich_text_label.cpp:7390`), and all three `ADD_PROPERTY` hint strings are
 * byte-identical. Only the setter's `file:line` varies, and that stays at each
 * call site as the `enforced` citation.
 *
 * `BREAK_TRIM_MASK = BREAK_TRIM_INDENT | BREAK_TRIM_START_EDGE_SPACES |
 * BREAK_TRIM_END_EDGE_SPACES` (servers/text/text_server.h:120) = 224.
 */
export const BREAK_TRIM_MASK = 32 | 64 | 128;

/** The three bits `BREAK_TRIM_MASK` keeps (servers/text/text_server.h:116-118). */
export const BREAK_TRIM_LABELS = {
  32: 'BREAK_TRIM_INDENT',
  64: 'BREAK_TRIM_START_EDGE_SPACES',
  128: 'BREAK_TRIM_END_EDGE_SPACES',
};

/**
 * What the inspector's flag list actually offers: `vformat("Trim Spaces After
 * Break:%d,Trim Spaces Before Break:%d", BREAK_TRIM_START_EDGE_SPACES,
 * BREAK_TRIM_END_EDGE_SPACES)`. Narrower than the mask, so BREAK_TRIM_INDENT is
 * kept by the setter yet unreachable from the editor, which is the warning arm.
 * Deliberately not `BREAK_TRIM_MASK & ~32`: this is the hint's own content, and
 * deriving it from the mask would make a future hint change invisible.
 */
export const BREAK_TRIM_HINTED_BITS = 64 | 128;

/**
 * `Control::TextDirection`, which aliases `TextServer::Direction` —
 * TEXT_DIRECTION_AUTO=0 … TEXT_DIRECTION_INHERITED=3 (scene/gui/control.h:166-171,
 * BIND_ENUM_CONSTANT control.cpp:4415-4418).
 */
export const TEXT_DIRECTION = {
  0: 'TEXT_DIRECTION_AUTO',
  1: 'TEXT_DIRECTION_LTR',
  2: 'TEXT_DIRECTION_RTL',
  3: 'TEXT_DIRECTION_INHERITED',
} as const;

/**
 * `TextServer::StructuredTextParser` — STRUCTURED_TEXT_DEFAULT=0 …
 * STRUCTURED_TEXT_CUSTOM=6 (servers/text/text_server.h:214-221).
 *
 * Five slices bound all seven from byte-identical copies: Label, LineEdit,
 * LinkButton, RichTextLabel and Label3D. That last one is why the file's
 * "text-bearing Control" framing is a shorthand rather than a rule — Label3D is
 * a GeometryInstance3D and re-binds the same server enum anyway, which is the
 * argument for sharing the labels regardless of where a class sits in the tree.
 *
 * Every hint string labels index 5 "None" while the constant there is
 * STRUCTURED_TEXT_GDSCRIPT. The labels below follow the ENUM, not the hint, so
 * a diagnostic names what the engine calls the value; all five copies noted
 * this separately, which is the sort of fact that should be stated once.
 */
export const STRUCTURED_TEXT_PARSER = {
  0: 'STRUCTURED_TEXT_DEFAULT',
  1: 'STRUCTURED_TEXT_URI',
  2: 'STRUCTURED_TEXT_FILE',
  3: 'STRUCTURED_TEXT_EMAIL',
  4: 'STRUCTURED_TEXT_LIST',
  5: 'STRUCTURED_TEXT_GDSCRIPT',
  6: 'STRUCTURED_TEXT_CUSTOM',
} as const;
