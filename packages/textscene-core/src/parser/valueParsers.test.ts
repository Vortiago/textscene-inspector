/**
 * Tests for the shared value decoders. The contract under test: fall back
 * SILENTLY when a value is absent, but WARN-then-fall-back when it is
 * present yet unparseable. `parseOptionalInt` is the exception — it returns
 * `undefined` and never warns.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as logger from '../logger';
import { floatOr, intOr, boolOr, enumOr, vec2Or, parseOptionalInt } from './valueParsers';

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
