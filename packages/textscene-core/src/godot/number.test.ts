/**
 * The INT token: `get_token` reads a number as an int until a `.` or an
 * exponent makes it a float (`variant_parser.cpp:420-451`, `:486-489`).
 */

import { describe, expect, it } from 'vitest';
import { INT_TOKEN_RE } from './number.js';

describe('INT_TOKEN_RE', () => {
  it.each(['0', '-1', '4294967295', '007'])('reads %s as an INT token', (text) => {
    expect(INT_TOKEN_RE.test(text)).toBe(true);
  });

  it.each(['1.0', '1.', '1e3', '-2E1'])('leaves %s to the FLOAT token', (text) => {
    expect(INT_TOKEN_RE.test(text)).toBe(false);
  });

  it.each(['+1', '0x1F', '', '-', '1 2'])('refuses %j, which get_token reads as no number', (text) => {
    expect(INT_TOKEN_RE.test(text)).toBe(false);
  });
});
