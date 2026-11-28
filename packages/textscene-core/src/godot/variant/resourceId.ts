import { STRING_LITERAL_SOURCE } from '../string/string.js';
import { FLOAT_PATTERN_SOURCE } from './number.js';
import { decimalFloat } from './decimalFloat.js';
import { stringify } from './variantStringify.js';
import { VARIANT_TYPE } from './variantType.js';

const STRING_TOKEN = new RegExp(`^${STRING_LITERAL_SOURCE}$`);
const NUMBER_TOKEN = new RegExp(`^${FLOAT_PATTERN_SOURCE}$`);
const INT64_MAX = (1n << 63n) - 1n;
const INT64_MIN = -(1n << 63n);
const ESCAPES: Readonly<Record<string, number>> = { b: 8, t: 9, n: 10, f: 12, r: 13 };
const encode = new TextEncoder();
const decode = new TextDecoder('utf-8', { ignoreBOM: true });

// string_buffer.h:160-162, ustring.cpp:2647-2677
function integerId(token: string): string {
  const negative = token.startsWith('-');
  let integer = 0n;
  for (let i = negative ? 1 : 0; i < token.length; i++) {
    if (integer > INT64_MAX / 10n) return String(negative ? INT64_MIN : INT64_MAX);
    integer = BigInt.asIntN(64, integer * 10n + BigInt(token.charCodeAt(i) - 48));
  }
  return String(BigInt.asIntN(64, negative ? -integer : integer));
}

// variant_parser.cpp:276-404
function quotedId(token: string): string | null {
  const body = token.slice(1, -1);
  if (!body.includes('\\')) return body;
  const bytes: number[] = [];
  const escapes = /\\(?:u([\da-fA-F]{4})|U([\da-fA-F]{6})|([\s\S]))/g;
  let start = 0;
  let lead = false;
  for (const match of body.matchAll(escapes)) {
    const literal = body.slice(start, match.index);
    if (lead && literal) return null;
    for (const byte of encode.encode(literal)) bytes.push(byte);
    const hex: string | undefined = match[1] ?? match[2];
    const next = match[3];
    if (next === 'u' || next === 'U') return null;
    const point = hex === undefined ? (ESCAPES[next!] ?? next!.charCodeAt(0)) : parseInt(hex, 16);
    const trail = point >= 0xdc00 && point <= 0xdfff;
    if (lead !== trail) return null;
    lead = point >= 0xd800 && point <= 0xdbff;
    if (!lead) bytes.push(point <= 255 ? point : 32);
    start = match.index + match[0].length;
  }
  if (lead) return null;
  for (const byte of encode.encode(body.slice(start))) bytes.push(byte);
  return decode.decode(Uint8Array.from(bytes));
}

/** @canonical read a resource loader ID from its quoted string or numeric Variant token */
export function loadedResourceId(token: string): string | null {
  if (STRING_TOKEN.test(token)) return quotedId(token);
  if (!NUMBER_TOKEN.test(token)) return null;
  return /[.eE]/.test(token)
    ? stringify({ type: VARIANT_TYPE.FLOAT, value: decimalFloat(token) })
    : integerId(token);
}
