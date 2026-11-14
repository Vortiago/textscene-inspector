/**
 * ThorVG's number reading for SVG values (`tvgSvgLoader.cpp`): white space, commas and lists of
 * numbers, as its path and transform readers split them.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import { isSpace, strToFloat } from './strToFloat';

export const skipSpace = (text: string, at: number): number => {
  while (isSpace(text[at])) at++;
  return at;
};

/** `_skipComma`: past white space and one comma. */
export function skipComma(text: string, at: number): number {
  at = skipSpace(text, at);
  return text[at] === ',' ? at + 1 : at;
}

/** `_parseNumbersArray`: up to `max` numbers, each started by a digit, a sign or a dot. */
export function parseNumbersArray(text: string, at: number, max: number): { numbers: number[]; end: number } {
  const numbers: number[] = [];
  at = skipSpace(text, at);
  while (numbers.length < max && /[0-9+\-.]/.test(text[at] ?? '')) {
    const { value, end } = strToFloat(text, at);
    numbers.push(value);
    at = skipSpace(text, end);
    if (text[at] === ',') at++;
    at = skipSpace(text, at);
  }
  return { numbers, end: at };
}
