import { repeat } from './edit.js';
import { substr } from './codes.js';

const DOT = 0x2e;
const ZERO = 0x30;

const isDigit = (code: number | undefined) => code !== undefined && code >= 0x30 && code <= 0x39;

/** `String::pad_decimals` (ustring.cpp:4660): exactly `digits` decimals, cut or padded with zeros. */
export function padDecimals(codes: readonly number[], digits: number): number[] {
  let dot = codes.indexOf(DOT);
  let padded = [...codes];
  if (dot === -1) {
    if (digits <= 0) return padded;
    padded = [...padded, DOT];
    dot = padded.length - 1;
  } else if (digits <= 0) return substr(padded, 0, dot);
  if (padded.length - (dot + 1) > digits) return substr(padded, 0, (dot + digits + 1) | 0);
  return [...padded, ...repeat([ZERO], (digits - padded.length + (dot + 1)) | 0)];
}

/** `String::pad_zeros` (ustring.cpp:4684): zeros after the leading non-digits. */
export function padZeros(codes: readonly number[], digits: number): number[] {
  const dot = codes.indexOf(DOT);
  const end = dot === -1 ? codes.length : dot;
  if (end === 0) return [...codes];
  let begin = 0;
  while (begin < end && !isDigit(codes[begin])) begin++;
  const zeros = (digits - (end - begin)) | 0;
  if (zeros <= 0) return [...codes];
  return [...codes.slice(0, begin), ...repeat([ZERO], zeros), ...codes.slice(begin)];
}
