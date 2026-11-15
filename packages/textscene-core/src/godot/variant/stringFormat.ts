/** `String::sprintf` (ustring.cpp:5185), the `%` operator of a String: each placeholder takes the next value. */

import { stringNum } from '../string/stringNumber.js';
import { doubleToInt32, doubleToInt64, wrapInt32 } from './cInteger.js';
import { stringify } from './stringify.js';
import type { Variant } from './value/variant.js';

/** The formatted text, or Godot's error text when `isError`. */
export interface Formatted {
  readonly text: string;
  readonly isError: boolean;
}

class FormatError extends Error {}

const fail = (message: string): never => {
  throw new FormatError(message);
};

const VECTOR_COUNTS: Readonly<Partial<Record<Variant['type'], number>>> = {
  VECTOR2: 2,
  VECTOR2I: 2,
  VECTOR3: 3,
  VECTOR3I: 3,
  VECTOR4: 4,
  VECTOR4I: 4,
};

const isNumber = (value: Variant) => value.type === 'INT' || value.type === 'FLOAT';
const asInt64 = (value: Variant) =>
  value.type === 'INT' ? value.value : doubleToInt64(value.value as number);
const asDouble = (value: Variant) => Number(value.value);
const asInt32 = (value: Variant) =>
  value.type === 'INT' ? wrapInt32(value.value) : value.type === 'FLOAT' ? doubleToInt32(value.value) : 0;

const lpad = (text: string, length: number, pad = ' ') =>
  length > [...text].length ? pad.repeat(length - [...text].length) + text : text;
const rpad = (text: string, length: number, pad = ' ') =>
  length > [...text].length ? text + pad.repeat(length - [...text].length) : text;

// String::pad_decimals (ustring.cpp:4660).
function padDecimals(text: string, digits: number): string {
  const point = text.indexOf('.');
  if (point < 0) return digits <= 0 ? text : `${text}.${'0'.repeat(digits)}`;
  if (digits <= 0) return text.slice(0, point);
  const decimals = text.length - (point + 1);
  return decimals > digits ? text.slice(0, point + digits + 1) : text + '0'.repeat(digits - decimals);
}

/** The flags of one placeholder, reset at each `%`. `asUnsigned` is not reset, as in Godot. */
class Placeholder {
  minChars = 0;
  minDecimals = 6;
  inDecimals = false;
  padWithZeros = false;
  leftJustified = false;
  showSign = false;

  pad(text: string, count: number, padChar = ' '): string {
    return this.leftJustified ? rpad(text, count, padChar) : lpad(text, count, padChar);
  }

  // The sign goes before zero padding, or right before the digits of a space-padded number.
  signed(text: string, numberLength: number, sign: string): string {
    if (this.leftJustified) return sign + text;
    const at = this.padWithZeros ? 0 : text.length - numberLength;
    return text.slice(0, at) + sign + text.slice(at);
  }

  number(digits: string, isNegative: boolean, isFinite = true): string {
    const count = isNegative || this.showSign ? this.minChars - 1 : this.minChars;
    const text = this.pad(digits, count, this.padWithZeros && isFinite ? '0' : ' ');
    if (!this.showSign && !isNegative) return text;
    return this.signed(text, digits.length, isNegative ? '-' : '+');
  }

  decimal(value: number): string {
    let text = stringNum(Math.abs(value), this.minDecimals);
    if (Number.isFinite(value)) text = padDecimals(text, this.minDecimals);
    return text;
  }
}

class Formatter {
  private readonly values: readonly Variant[];
  private index = 0;
  private asUnsigned = false;

  constructor(values: readonly Variant[]) {
    this.values = values;
  }

  private next(): Variant {
    if (this.index >= this.values.length) fail('not enough arguments for format string');
    return this.values[this.index++]!;
  }

  format(text: string): string {
    let formatted = '';
    let placeholder: Placeholder | undefined;
    for (const char of text) {
      if (placeholder === undefined) {
        if (char === '%') placeholder = new Placeholder();
        else formatted += char;
        continue;
      }
      const written = this.placeholderChar(placeholder, char);
      if (written === undefined) continue;
      formatted += written;
      placeholder = undefined;
    }
    if (placeholder) fail('incomplete format');
    if (this.index !== this.values.length) fail('not all arguments converted during string formatting');
    return formatted;
  }

  // The text a conversion writes, or nothing for a flag that leaves the placeholder open.
  private placeholderChar(placeholder: Placeholder, char: string): string | undefined {
    switch (char) {
      case '%':
        return '%';
      case 'd':
      case 'o':
      case 'x':
      case 'X':
        return this.integer(placeholder, char);
      case 'f':
        return this.float(placeholder);
      case 'v':
        return this.vector(placeholder);
      case 's':
        return placeholder.pad(stringify(this.next()), placeholder.minChars);
      case 'c':
        return placeholder.pad(this.character(), placeholder.minChars);
      case '-':
        placeholder.leftJustified = true;
        return undefined;
      case '+':
        placeholder.showSign = true;
        return undefined;
      case 'u':
        this.asUnsigned = true;
        return undefined;
      case '.':
        if (placeholder.inDecimals) fail('too many decimal points in format');
        placeholder.inDecimals = true;
        placeholder.minDecimals = 0;
        return undefined;
      case '*':
        this.width(placeholder);
        return undefined;
      default:
        if (char >= '0' && char <= '9') {
          this.digit(placeholder, Number(char));
          return undefined;
        }
        return fail('unsupported format character');
    }
  }

  private digit(placeholder: Placeholder, digit: number): void {
    if (placeholder.inDecimals) placeholder.minDecimals = placeholder.minDecimals * 10 + digit;
    else if (digit === 0 && placeholder.minChars === 0)
      placeholder.padWithZeros ||= !placeholder.leftJustified;
    else placeholder.minChars = placeholder.minChars * 10 + digit;
  }

  private width(placeholder: Placeholder): void {
    const value = this.next();
    if (!isNumber(value) && VECTOR_COUNTS[value.type] === undefined) fail('* wants number or vector');
    const size = asInt32(value);
    if (placeholder.inDecimals) placeholder.minDecimals = size;
    else placeholder.minChars = size;
  }

  private integer(placeholder: Placeholder, char: string): string {
    const value = this.next();
    if (!isNumber(value)) fail('a number is required');
    const number = asInt64(value);
    const base = char === 'd' ? 10 : char === 'o' ? 8 : 16;
    let digits: string;
    if (!this.asUnsigned) {
      digits = (number < 0n ? -number : number).toString(base);
    } else {
      let unsigned = BigInt.asUintN(64, number);
      // In unsigned hex, a value that fits in 32 bits is trimmed to them.
      if (base === 16 && number < 0n && number >= -(2n ** 31n)) unsigned &= 0xffffffffn;
      digits = unsigned.toString(base);
    }
    if (char === 'X') digits = digits.toUpperCase();
    return placeholder.number(digits, number < 0n && !this.asUnsigned);
  }

  private float(placeholder: Placeholder): string {
    const value = this.next();
    if (!isNumber(value)) fail('a number is required');
    const number = asDouble(value);
    const isNegative = number < 0 || Object.is(number, -0);
    return placeholder.number(placeholder.decimal(number), isNegative, Number.isFinite(number));
  }

  private vector(placeholder: Placeholder): string {
    const value = this.next();
    const count = VECTOR_COUNTS[value.type];
    if (count === undefined) return fail('%v requires a vector type (Vector2/3/4/2i/3i/4i)');
    const components = value.value as Readonly<Record<string, number>>;
    const parts = ['x', 'y', 'z', 'w'].slice(0, count).map((key) => {
      // `Vector4 vec = values[i]`: an int component becomes a float first.
      const component = Math.fround(components[key]!);
      const digits = placeholder.decimal(component);
      const count = component < 0 ? placeholder.minChars - 1 : placeholder.minChars;
      const text = placeholder.pad(
        digits,
        count,
        placeholder.padWithZeros && Number.isFinite(component) ? '0' : ' '
      );
      return component < 0 ? placeholder.signed(text, digits.length, '-') : text;
    });
    return `(${parts.join(', ')})`;
  }

  private character(): string {
    const value = this.next();
    if (isNumber(value)) {
      const code = asInt32(value);
      if (code < 0) fail('unsigned integer is lower than minimum');
      if (code >= 0xd800 && code <= 0xdfff) fail('unsigned integer is invalid Unicode character');
      if (code > 0x10ffff) fail('unsigned integer is greater than maximum');
      return String.fromCodePoint(code);
    }
    if (value.type === 'STRING' && [...value.value].length === 1) return value.value;
    return fail('%c requires number or single-character string');
  }
}

export function stringFormat(text: string, values: readonly Variant[]): Formatted {
  try {
    return { text: new Formatter(values).format(text), isError: false };
  } catch (error) {
    if (error instanceof FormatError) return { text: error.message, isError: true };
    throw error;
  }
}
