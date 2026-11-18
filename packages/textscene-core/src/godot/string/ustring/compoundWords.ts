import { findLower, findUpper } from '../caseMapping.js';
import { isUnicodeLowerCase, isUnicodeUpperCase } from '../characterClass.js';
import { isDigitCode, isWhitespace } from '../charUtils.js';
import { append } from './codes.js';
import { sliceAtCode, sliceCount } from './search.js';
import { replaceCodes, stripEdges } from './edit.js';

const SPACE = 0x20;
const isSeparator = (code: number) =>
  code === 0x5f || code === 0x2d || isWhitespace(String.fromCodePoint(code));

/** `String::_separate_compound_words` (ustring.cpp:702): a space at each word edge, then lower case. */
function separateCompoundWords(codes: readonly number[]): number[] {
  if (codes.length === 0) return [];
  const words: number[] = [];
  let start = 0;
  for (let at = 1; at < codes.length; at++) {
    const [previous, current, next] = [codes[at - 1]!, codes[at]!, codes[at + 1]];
    const isNextLower = next !== undefined && isUnicodeLowerCase(next);
    const isPreviousUpper = isUnicodeUpperCase(previous);
    const isPreviousLower = isUnicodeLowerCase(previous);
    const isWordEdge =
      (isPreviousLower && isUnicodeUpperCase(current)) ||
      ((isPreviousUpper || isDigitCode(previous)) && isUnicodeUpperCase(current) && isNextLower) ||
      (isDigitCode(previous) && isUnicodeLowerCase(current) && isNextLower) ||
      ((isPreviousUpper || isPreviousLower) && isDigitCode(current));
    if (!isWordEdge) continue;
    append(words, codes.slice(start, at), [SPACE]);
    start = at;
  }
  append(words, codes.slice(start));
  return words.map((code) => findLower(isSeparator(code) ? SPACE : code));
}

/** Each word of the stripped compound words, with the case `firstCode` gives its first code by index. */
function joinWords(
  codes: readonly number[],
  firstCode: (code: number, index: number) => number,
  glue: number[]
) {
  const words = stripEdges(separateCompoundWords(codes), true, true);
  const result: number[] = [];
  const spaces = [SPACE];
  for (let index = 0; index < sliceCount(words, spaces); index++) {
    const word = sliceAtCode(words, SPACE, index);
    if (word.length === 0) continue;
    if (index > 0) append(result, glue);
    append(result, [firstCode(word[0]!, index)], word.slice(1));
  }
  return result;
}

/** `String::capitalize` (ustring.cpp:755): words split by a space, each with an upper-case first code. */
export const capitalize = (codes: readonly number[]): number[] => joinWords(codes, findUpper, [SPACE]);

/** `String::to_camel_case` (ustring.cpp:771). */
export const toCamelCase = (codes: readonly number[]): number[] =>
  joinWords(codes, (code, index) => (index === 0 ? findLower(code) : findUpper(code)), []);

/** `String::to_pascal_case` (ustring.cpp:788). */
export const toPascalCase = (codes: readonly number[]): number[] => joinWords(codes, findUpper, []);

/** `String::to_snake_case` (ustring.cpp:801). */
export const toSnakeCase = (codes: readonly number[]): number[] =>
  replaceCodes(separateCompoundWords(codes), [SPACE], 0x5f);

/** `String::to_kebab_case` (ustring.cpp:805). */
export const toKebabCase = (codes: readonly number[]): number[] =>
  replaceCodes(separateCompoundWords(codes), [SPACE], 0x2d);
