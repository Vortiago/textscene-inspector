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
