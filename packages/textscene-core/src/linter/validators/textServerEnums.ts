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
