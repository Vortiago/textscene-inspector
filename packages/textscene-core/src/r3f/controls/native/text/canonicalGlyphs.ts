/**
 * The characters a font draws for a cluster of a base and its marks. HarfBuzz normalises the text
 * before it maps glyphs (`hb-ot-shape-normalize.cc`): it decomposes a character the font lacks into
 * a base and marks the font has, and joins a mark to its base where the font has the composite.
 * Godot then marks the cluster valid, and draws it in that font (`text_server_adv.cpp:7119-7170`).
 */

import { COMBINING_CLASS_RUNS } from './combiningClasses';
import { codePointCount } from '../../../../godot/string/codePoints';

/** The canonical combining class of a code point, 0 for a character with none. */
export function combiningClassOf(codePoint: number): number {
  let low = 0;
  let high = COMBINING_CLASS_RUNS.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const [first, last, klass] = COMBINING_CLASS_RUNS[middle]!;
    if (codePoint < first) high = middle - 1;
    else if (codePoint > last) low = middle + 1;
    else return klass;
  }
  return 0;
}

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

const classOf = (ch: string): number => combiningClassOf(ch.codePointAt(0)!);

const STARTS_WITH_MARK = /^\p{M}/u;
const HOLDS_MARK = /\p{M}/u;

/** Whether `ch` starts with a combining mark, which shapes in the cluster of the base before it. */
export const isCombiningMark = (ch: string): boolean => STARTS_WITH_MARK.test(ch);

/** Whether `text` holds a combining mark anywhere. */
export const hasCombiningMark = (text: string): boolean => HOLDS_MARK.test(text);

/**
 * Sorts each run of characters with a combining class by its class, keeping the order of equal
 * classes (`hb-ot-shape-normalize.cc`, the second round). Mutates `characters`.
 */
function reorderMarks(characters: string[]): void {
  for (let start = 0; start < characters.length; start++) {
    if (classOf(characters[start]!) === 0) continue;
    let end = start + 1;
    while (end < characters.length && classOf(characters[end]!) !== 0) end++;
    const sorted = characters.slice(start, end).sort((a, b) => classOf(a) - classOf(b));
    characters.splice(start, end - start, ...sorted);
    start = end;
  }
}

/** The primary composite of `starter` and `mark`, or null for a pair that has none. */
function compositeOf(starter: string, mark: string): string | null {
  const composed = (starter + mark).normalize('NFC');
  return codePointCount(composed) === 1 ? composed : null;
}

/**
 * Joins each mark to the starter before it where the font has their composite and no mark between
 * them blocks it (`hb-ot-shape-normalize.cc`, the third round). A starter never joins a character
 * that is no mark. Mutates `characters`.
 */
function recompose(characters: string[], hasCharacter: (ch: string) => boolean): void {
  let starter = 0;
  for (let i = 1; i < characters.length;) {
    const ch = characters[i]!;
    const isUnblocked = starter === i - 1 || classOf(characters[i - 1]!) < classOf(ch);
    const composite = isCombiningMark(ch) && isUnblocked ? compositeOf(characters[starter]!, ch) : null;
    if (composite && hasCharacter(composite)) {
      characters[starter] = composite;
      characters.splice(i, 1);
      continue;
    }
    if (classOf(ch) === 0) starter = i;
    i++;
  }
}

/**
 * The characters `cluster` draws as in a font, in order, as HarfBuzz's normalisation of the default
 * shaper gives them (`COMPOSED_DIACRITICS`): each character splits while the font lacks it, the marks
 * sort by combining class, and each mark joins its base where the font has the composite, a mark the
 * font lacks too. Null where the font cannot draw a character of the result. Hebrew, Arabic and the scripts of Southeast Asia reorder
 * their marks by HarfBuzz's own classes in their script shapers, which are not ported.
 */
export function normalisedCharacters(
  cluster: string,
  hasCharacter: (ch: string) => boolean
): readonly string[] | null {
  const characters: string[] = [];
  // A character the font cannot draw stays whole, as HarfBuzz keeps it for the recomposition.
  for (const ch of cluster) characters.push(...(drawnCharacters(ch, hasCharacter) ?? [ch]));
  reorderMarks(characters);
  recompose(characters, hasCharacter);
  return characters.every(hasCharacter) ? characters : null;
}
