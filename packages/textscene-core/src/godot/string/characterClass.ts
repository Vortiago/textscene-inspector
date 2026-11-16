import {
  IDENTIFIER_CONTINUE,
  IDENTIFIER_START,
  LETTER,
  LOWER_CASE_LETTER,
  UPPER_CASE_LETTER,
} from './characterClasses.generated.js';

/** `BSEARCH_CHAR_RANGE` (char_utils.h:40): whether a range of a flat start, end table holds `code`. */
function inRanges(ranges: readonly number[], code: number): boolean {
  let low = 0;
  let high = ranges.length / 2 - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (code < ranges[2 * middle]!) high = middle - 1;
    else if (code > ranges[2 * middle + 1]!) low = middle + 1;
    else return true;
  }
  return false;
}

const codeOf = (char: string) => char.codePointAt(0) ?? 0;

/**
 * `is_unicode_identifier_start` (char_utils.h:59) of the code point that starts `char`.
 *
 * @canonical Whether a character starts a Unicode identifier
 */
export const isUnicodeIdentifierStart = (char: string): boolean => inRanges(IDENTIFIER_START, codeOf(char));

/** `is_unicode_identifier_continue` (char_utils.h:63) of the code point that starts `char`. */
export const isUnicodeIdentifierContinue = (char: string): boolean =>
  inRanges(IDENTIFIER_CONTINUE, codeOf(char));

/** `is_unicode_upper_case` (char_utils.h:67). */
export const isUnicodeUpperCase = (code: number): boolean => inRanges(UPPER_CASE_LETTER, code);

/** `is_unicode_lower_case` (char_utils.h:71). */
export const isUnicodeLowerCase = (code: number): boolean => inRanges(LOWER_CASE_LETTER, code);

/** `is_unicode_letter` (char_utils.h:75). */
export const isUnicodeLetter = (code: number): boolean => inRanges(LETTER, code);
