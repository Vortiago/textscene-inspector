/**
 * Tests for the shared value decoders. The contract under test: fall back
 * SILENTLY when a value is absent, but WARN-then-fall-back when it is
 * present yet unparseable. `parseOptionalInt` is the exception — it returns
 * `undefined` and never warns.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as logger from '../logger';
import {
  floatOr,
  intOr,
  boolOr,
  vec2iOr,
  parseOptionalVector2i,
  enumOr,
  vec2Or,
  parseOptionalInt,
  parseOptionalFloat,
  parseNodePathLiteral,
  settableNonNegative,
  nonNegativeOr,
  nonNegativeSizeOr,
  parseOptionalRect2,
} from './valueParsers';

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe('scalar readers speak the tokenizer grammar', () => {
  it('reads an exponent at its real magnitude, as the linter does', () => {
    // `parseInt` gave 2, so the previewer drew a 2-column grid while the
    // linter judged the frame index against Godot's 20.
    expect(intOr('2e1', 1)).toBe(20);
    expect(parseOptionalInt('2e1')).toBe(20);
    expect(floatOr('2e1', -1)).toBe(20);
  });

  it('truncates toward zero in an int slot, as the conversion does', () => {
    expect(intOr('5.9', 0)).toBe(5);
    expect(intOr('-5.9', 0)).toBe(-5);
  });

  it('falls back on text Godot cannot read, instead of taking its prefix', () => {
    for (const bad of ['1.2.3', '1abc', '+1', '.5', '0x10']) {
      expect(floatOr(bad, -1)).toBe(-1);
      expect(intOr(bad, -1)).toBe(-1);
    }
  });

  it('still falls back on a non-finite, which is the documented renderer split', () => {
    for (const spelling of ['inf', '-inf', 'inf_neg', 'nan']) {
      expect(floatOr(spelling, -1)).toBe(-1);
      expect(intOr(spelling, -1)).toBe(-1);
    }
  });
});

describe('floatOr', () => {
  it('parses a valid float', () => {
    expect(floatOr('1.5', 0)).toBe(1.5);
    expect(floatOr('-2', 0)).toBe(-2);
  });
  it('falls back silently when absent', () => {
    expect(floatOr(undefined, 0.01)).toBe(0.01);
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('warns then falls back when present but invalid', () => {
    expect(floatOr('abc', 0.01, 'Sprite3D.pixel_size')).toBe(0.01);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('Sprite3D.pixel_size');
  });
});

describe('intOr', () => {
  it('parses a valid int', () => {
    expect(intOr('42', 0)).toBe(42);
  });
  it('falls back silently when absent', () => {
    expect(intOr(undefined, 1)).toBe(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('warns then falls back when present but invalid', () => {
    expect(intOr('nope', 1)).toBe(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe('boolOr', () => {
  it('parses true/1 and false/0', () => {
    expect(boolOr('true', false)).toBe(true);
    expect(boolOr('1', false)).toBe(true);
    expect(boolOr('false', true)).toBe(false);
    expect(boolOr('0', true)).toBe(false);
  });
  it('falls back silently when absent', () => {
    expect(boolOr(undefined, true)).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('warns then falls back when present but invalid', () => {
    expect(boolOr('maybe', false)).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe('enumOr', () => {
  const allowed = [0, 1, 2] as const;
  it('parses a value within the allowed set', () => {
    expect(enumOr('2', 0, allowed)).toBe(2);
  });
  it('falls back silently when absent', () => {
    expect(enumOr(undefined, 1, allowed)).toBe(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('warns then falls back when not numeric', () => {
    expect(enumOr('x', 0, allowed)).toBe(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
  it('warns then falls back when out of the allowed range', () => {
    expect(enumOr('9', 0, allowed)).toBe(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe('vec2Or', () => {
  it('parses a valid Vector2', () => {
    expect(vec2Or('Vector2(3, 4)', { x: 0, y: 0 })).toEqual({ x: 3, y: 4 });
  });
  it('falls back silently when absent', () => {
    expect(vec2Or(undefined, { x: 1, y: 1 })).toEqual({ x: 1, y: 1 });
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('warns then falls back when present but invalid', () => {
    expect(vec2Or('Vector2(oops)', { x: 1, y: 1 }, 'Sprite2D')).toEqual({ x: 1, y: 1 });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('Sprite2D');
  });
});

describe('parseOptionalInt', () => {
  it('parses a valid int', () => {
    expect(parseOptionalInt('7')).toBe(7);
  });
  it('returns undefined for an absent value, without warning', () => {
    expect(parseOptionalInt(undefined)).toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('returns undefined for an invalid value, without warning', () => {
    expect(parseOptionalInt('nope')).toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('parseOptionalFloat', () => {
  it('parses a valid float, including scientific notation', () => {
    expect(parseOptionalFloat('1.5')).toBe(1.5);
    expect(parseOptionalFloat('-2')).toBe(-2);
    expect(parseOptionalFloat('1e-05')).toBe(1e-5);
  });
  it('returns undefined for an absent value, without warning', () => {
    expect(parseOptionalFloat(undefined)).toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('returns undefined (never NaN) for an invalid value, without warning', () => {
    const result = parseOptionalFloat('nope');
    expect(result).toBeUndefined();
    expect(Number.isNaN(result)).toBe(false);
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('returns undefined for an empty string (parseFloat("") is NaN)', () => {
    expect(parseOptionalFloat('')).toBeUndefined();
  });
});

describe('vec2iOr / parseOptionalVector2i', () => {
  it('parses a Vector2i literal (happy path)', () => {
    expect(vec2iOr('Vector2i(600, 400)', { x: 0, y: 0 })).toEqual({ x: 600, y: 400 });
    expect(vec2iOr('Vector2i( -3 , 4 )', { x: 0, y: 0 })).toEqual({ x: -3, y: 4 });
    expect(parseOptionalVector2i('Vector2i(1, 2)')).toEqual({ x: 1, y: 2 });
  });

  it('falls back silently when absent, and returns undefined on the optional arm', () => {
    expect(vec2iOr(undefined, { x: 512, y: 512 })).toEqual({ x: 512, y: 512 });
    expect(vec2iOr('', { x: 512, y: 512 })).toEqual({ x: 512, y: 512 });
    expect(parseOptionalVector2i(undefined)).toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('TRUNCATES a float or exponent component, as the INT conversion does', () => {
    // `_parse_construct<int32_t>` (variant_parser.cpp:552-596) takes any number
    // token and pushes it into a `Vector<int32_t>`, so Godot loads these and
    // narrows toward zero. Refusing them fell back to a default size on a
    // scene Godot opens. That `itos` cannot WRITE one bounds nothing.
    expect(vec2iOr('Vector2i(1.5, 2)', { x: 9, y: 9 })).toEqual({ x: 1, y: 2 });
    expect(vec2iOr('Vector2i(-1.5, 2)', { x: 9, y: 9 })).toEqual({ x: -1, y: 2 });
    expect(vec2iOr('Vector2i(2e1, 2e1)', { x: 9, y: 9 })).toEqual({ x: 20, y: 20 });
    expect(parseOptionalVector2i('Vector2i(1.5, 2)')).toEqual({ x: 1, y: 2 });
  });

  it('warns-then-falls-back on a present-but-malformed value (error path)', () => {
    expect(vec2iOr('Vector2i(nope)', { x: 512, y: 512 })).toEqual({ x: 512, y: 512 });
    expect(vec2iOr('Vector2i(1, 2) trailing', { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    // `Vector2(...)` is NOT here: it converts. See the test below.
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe('parseNodePathLiteral', () => {
  it('extracts the inner path from a NodePath("...") literal (happy path)', () => {
    expect(parseNodePathLiteral('NodePath("../Camera2D")')).toBe('../Camera2D');
  });
  it('returns an empty string for an empty NodePath("") literal (edge case)', () => {
    expect(parseNodePathLiteral('NodePath("")')).toBe('');
  });
  it('returns null for a value that is not a NodePath literal (error path)', () => {
    expect(parseNodePathLiteral('"../Camera2D"')).toBeNull();
    expect(parseNodePathLiteral('../Camera2D')).toBeNull();
  });
  it('returns null for an absent value, without warning', () => {
    expect(parseNodePathLiteral(undefined)).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('settableNonNegative / nonNegativeOr', () => {
  it('reads a non-negative value', () => {
    expect(settableNonNegative('2.5', 'Shape')).toBe(2.5);
    expect(nonNegativeOr('2.5', 0.5, 'Shape')).toBe(2.5);
    expect(settableNonNegative('0', 'Shape')).toBe(0);
  });

  it('treats an absent value as unset, silently', () => {
    expect(settableNonNegative(undefined, 'Shape')).toBeUndefined();
    expect(nonNegativeOr(undefined, 0.5, 'Shape')).toBe(0.5);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('refuses a negative value the way Godot ERR_FAILs it, and warns', () => {
    // The setter returns before assigning, so the property keeps its default.
    expect(settableNonNegative('-3', 'Shape')).toBeUndefined();
    expect(nonNegativeOr('-3', 0.5, 'Shape')).toBe(0.5);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('warns then reports unset for an unparseable value (never NaN)', () => {
    expect(settableNonNegative('nope', 'Shape')).toBeUndefined();
    expect(nonNegativeOr('nope', 0.5, 'Shape')).toBe(0.5);
    expect(Number.isNaN(nonNegativeOr('nope', 0.5, 'Shape'))).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe('nonNegativeSizeOr', () => {
  const FALLBACK_2D = { x: 20, y: 20 };
  const FALLBACK_3D = { x: 1, y: 1, z: 1 };

  it('passes a non-negative size through unchanged', () => {
    expect(nonNegativeSizeOr({ x: 4, y: 6 }, FALLBACK_2D, 'Rect')).toEqual({ x: 4, y: 6 });
    expect(nonNegativeSizeOr({ x: 0, y: 0, z: 0 }, FALLBACK_3D, 'Box')).toEqual({
      x: 0,
      y: 0,
      z: 0,
    });
  });

  it('refuses the WHOLE size when any component is negative, not just that one', () => {
    // Godot's set_size ERR_FAILs on the call, so no component is stored; a
    // per-component clamp would invent a size Godot never holds.
    expect(nonNegativeSizeOr({ x: 4, y: -1 }, FALLBACK_2D, 'Rect')).toEqual(FALLBACK_2D);
    expect(nonNegativeSizeOr({ x: 1, y: 2, z: -3 }, FALLBACK_3D, 'Box')).toEqual(FALLBACK_3D);
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe('parseOptionalRect2', () => {
  it('is silent and unset when the property is absent', () => {
    expect(parseOptionalRect2(undefined, 'Rect')).toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('parses the Godot form, scientific notation and negatives included', () => {
    expect(parseOptionalRect2('Rect2(0, 0, 16, 24)', 'Rect')).toEqual({
      x: 0,
      y: 0,
      width: 16,
      height: 24,
    });
    expect(parseOptionalRect2('Rect2( -8.5, 1e-05, 2E+1, 4 )', 'Rect')).toEqual({
      x: -8.5,
      y: 1e-5,
      width: 20,
      height: 4,
    });
  });

  it('warns and reports unset for every malformed component the loose grammar accepted', () => {
    for (const bad of ['Rect2(1.2.3, 0, 8, 8)', 'Rect2(--1, 0, 8, 8)', 'Rect2(+1, 0, 8, 8)', 'Rect2(1, 2, 3)', 'notarect']) {
      expect(parseOptionalRect2(bad, 'Rect')).toBeUndefined();
    }
    expect(warnSpy).toHaveBeenCalledTimes(5);
  });
});

describe('vec2iOr takes the spellings can_convert_strict converts', () => {
  // The renderer half of the conversion widening. Nothing asserted it, so
  // dropping `compositeSpellings` from `slotTupleRegex` would revert this —
  // and every reader in tileset, curve and vectors with it — while the suite
  // stayed green.
  it('reads a Vector2 into a Vector2i slot rather than falling back', () => {
    expect(vec2iOr('Vector2(1920, 1080)', { x: 512, y: 512 })).toEqual({ x: 1920, y: 1080 });
  });

  it('truncates a fractional component, as the int32 conversion does', () => {
    expect(vec2iOr('Vector2(1.9, 2.9)', { x: 0, y: 0 })).toEqual({ x: 1, y: 2 });
  });

  it('still refuses a type that does NOT convert', () => {
    expect(vec2iOr('Color(1, 1, 1, 1)', { x: 7, y: 7 })).toEqual({ x: 7, y: 7 });
  });
});

describe('the conversion branch follows the composite type, not the token', () => {
  // MEASURED on 4.6.3: `ItemList.fixed_icon_size = Vector2(4294967295, 64)`
  // stores `(-2147483648, 64)` — the UB double->int32 sentinel, because a
  // Vector2 holds doubles — while `Vector2i(4294967295, 64)` stores
  // `(-1, 64)` by wrapping an int64. The token is identical in both.
  it('refuses a converted component the double branch cannot hold', () => {
    expect(vec2iOr('Vector2(4294967295, 64)', { x: -1, y: -1 })).toEqual({ x: -1, y: -1 });
  });

  it('still wraps the same digits in the canonical spelling', () => {
    expect(vec2iOr('Vector2i(4294967295, 64)', { x: -9, y: -9 })).toEqual({ x: -1, y: 64 });
  });

  it('leaves an ordinary converted value alone', () => {
    expect(vec2iOr('Vector2(100, 64)', { x: -9, y: -9 })).toEqual({ x: 100, y: 64 });
  });

  it('reads the optional arm through the same branch', () => {
    // `frame_coords` on Sprite2D/Sprite3D, where -1 is a frame Godot never
    // selects.
    expect(parseOptionalVector2i('Vector2(4294967295, 64)')).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    expect(parseOptionalVector2i('Vector2i(4294967295, 64)')).toEqual({ x: -1, y: 64 });
    expect(parseOptionalVector2i('Vector2(100, 64)')).toEqual({ x: 100, y: 64 });
  });
});

describe('parseOptionalInt width', () => {
  // The bitmask slots it reads are uint32 in the engine and declared uint32 on
  // the linter side, so a value the linter accepts must not read back narrowed.
  it('reads a uint32 slot without narrowing to int32', () => {
    expect(parseOptionalInt('2147483648', 'uint32')).toBe(2147483648);
    expect(parseOptionalInt('4294967295', 'uint32')).toBe(4294967295);
  });

  it('keeps a FLOAT literal inside the uint32 range instead of dropping it', () => {
    // int32 called 3e9 unrepresentable and returned undefined, and every caller
    // then fell back to its default — layers 3e9 rendered as layer 1.
    expect(parseOptionalInt('3e9', 'uint32')).toBe(3000000000);
  });

  it('still defaults to int32', () => {
    expect(parseOptionalInt('2147483648')).toBe(-2147483648);
  });
});

describe('an overflowing exponent is inside the finite grammar', () => {
  it('falls back rather than handing three.js an Infinity', () => {
    expect(vec2Or('Vector2(1e999, 0)', { x: 9, y: 9 })).toEqual({ x: 9, y: 9 });
    expect(vec2Or('Vector2(1.5, 2)', { x: 9, y: 9 })).toEqual({ x: 1.5, y: 2 });
    expect(parseOptionalRect2('Rect2(0, 0, 1e999, 4)')).toBeUndefined();
    expect(parseOptionalRect2('Rect2(0, 0, 3, 4)')).toEqual({ x: 0, y: 0, width: 3, height: 4 });
  });
});
