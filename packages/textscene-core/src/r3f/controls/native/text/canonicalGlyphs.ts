/**
 * The characters a font draws for one character it may lack. HarfBuzz normalises the text before it
 * maps glyphs, and decomposes a character the font lacks into a base and marks the font has
 * (`hb-ot-shape-normalize.cc`, `decompose_current_character`). Godot then marks the cluster valid,
 * and draws it in that font (`text_server_adv.cpp:7119-7170`).
 */

/** The canonical decomposition of `ch` in two steps: the composite that holds all but the last mark, and that mark. */
function canonicalPair(ch: string): [string, string] | null {
  const decomposed = Array.from(ch.normalize('NFD'));
  if (decomposed.length < 2) return null;
  const mark = decomposed.pop()!;
  return [decomposed.join('').normalize('NFC'), mark];
}

/**
 * The characters `ch` draws as, in order, or null where the font cannot draw it. A character the
 * font has draws as itself. Any other splits in two, as `Ǟ` into `Ä` and a macron, and each half
 * splits again while the font lacks it.
 */
export function drawnCharacters(ch: string, hasCharacter: (ch: string) => boolean): readonly string[] | null {
  if (hasCharacter(ch)) return [ch];
  const pair = canonicalPair(ch);
  if (!pair) return null;
  const [composite, mark] = pair;
  const head = drawnCharacters(composite, hasCharacter);
  const tail = drawnCharacters(mark, hasCharacter);
  return head && tail ? [...head, ...tail] : null;
}
