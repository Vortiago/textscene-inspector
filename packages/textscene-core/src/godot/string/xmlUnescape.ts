/**
 * `String::xml_unescape` (`core/string/ustring.cpp:4532-4660`): the five named entities and the
 * decimal and hex character references. A reference that does not end in `;`, overflows 32 bits or
 * names code point zero stays as it is, as does every other `&`.
 */

const NAMED_ENTITIES: readonly (readonly [entity: string, character: string])[] = [
  ['&gt;', '>'],
  ['&lt;', '<'],
  ['&amp;', '&'],
  ['&quot;', '"'],
  ['&apos;', "'"],
];

const UINT32_MAX = 0xffffffff;

/** `text` with its XML references replaced. */
export function xmlUnescape(text: string): string {
  const source = [...text];
  let unescaped = '';
  let at = 0;
  while (at < source.length) {
    const { character, length } =
      source[at] === '&' ? referenceAt(source, at) : { character: source[at]!, length: 1 };
    unescaped += character;
    at += length;
  }
  return unescaped;
}

/** The character the `&` at `at` stands for, and how many characters it takes: one where it stands for itself. */
function referenceAt(source: readonly string[], at: number): { character: string; length: number } {
  const remaining = source.length - at;
  if (remaining >= 4 && source[at + 1] === '#') return characterReferenceAt(source, at);
  for (const [entity, character] of NAMED_ENTITIES) {
    if (remaining >= entity.length && source.slice(at, at + entity.length).join('') === entity)
      return { character, length: entity.length };
  }
  return { character: '&', length: 1 };
}

function characterReferenceAt(source: readonly string[], at: number): { character: string; length: number } {
  const isHex = source[at + 2] === 'x';
  let codePoint = 0;
  let isOverflow = false;
  let length = 0;
  for (let i = isHex ? 3 : 2; at + i < source.length; i++) {
    length = i + 1;
    const character = source[at + i]!;
    if (character === ';') break;
    const digit = Number.parseInt(character, isHex ? 16 : 10);
    if (Number.isNaN(digit)) break;
    if (isHex) {
      if (codePoint > UINT32_MAX >>> 4) {
        isOverflow = true;
        break;
      }
      codePoint = codePoint * 16 + digit;
    } else {
      codePoint = codePoint * 10 + digit;
    }
  }
  if (!isHex && codePoint > UINT32_MAX) isOverflow = true;
  if (codePoint === 0 || isOverflow || source[at + length - 1] !== ';') return { character: '&', length: 1 };
  return { character: codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : '�', length };
}
