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
    expect(vec2iOr('Vector2(1, 2)', { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
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
