/**
 * `parseBBCodeRuns`/`hasOpenTag`/`lastTagValue`/`resolveBBColor` — the
 * framework-free half of the BBCode subset (ADR-0003's [b]/[i]/[u]/[s]/
 * [color]/[center]/[code]), extracted so both the DOM `<RichTextLabel>`
 * (`bbcode.tsx`) and the native painter can tokenize the SAME tag stack
 * without either depending on React.
 */
import { describe, expect, it } from 'vitest';
import { hasOpenTag, lastTagValue, parseBBCodeRuns, resolveBBColor } from './bbcode';

describe('parseBBCodeRuns', () => {
  it('returns a single untagged run for plain text', () => {
    const runs = parseBBCodeRuns('just text');
    expect(runs).toEqual([{ text: 'just text', tags: [] }]);
  });

  it('opens and closes a single tag around a run', () => {
    const runs = parseBBCodeRuns('a [b]bold[/b] b');
    expect(runs).toEqual([
      { text: 'a ', tags: [] },
      { text: 'bold', tags: [{ name: 'b' }] },
      { text: ' b', tags: [] },
    ]);
  });

  it('carries a [name=value] tag\'s value, preserving internal spaces', () => {
    const runs = parseBBCodeRuns('[color=Color(1, 0, 0, 1)]x[/color]');
    expect(runs).toEqual([{ text: 'x', tags: [{ name: 'color', value: 'Color(1, 0, 0, 1)' }] }]);
  });

  it('stacks nested tags outermost-first', () => {
    const runs = parseBBCodeRuns('[b][i]x[/i][/b]');
    expect(runs).toEqual([
      { text: 'x', tags: [{ name: 'b' }, { name: 'i' }] },
    ]);
  });

  it('drops an unknown tag from styling but keeps it on the stack (so its own close pops correctly) and keeps the inner text', () => {
    const runs = parseBBCodeRuns('[wave amp=50]keep[/wave]');
    expect(runs).toEqual([{ text: 'keep', tags: [{ name: 'wave' }] }]);
  });

  it('lowercases tag names', () => {
    const runs = parseBBCodeRuns('[B]x[/B]');
    expect(runs[0]!.tags).toEqual([{ name: 'b' }]);
  });

  it('emits no run for text between two adjacent tags', () => {
    const runs = parseBBCodeRuns('[b][/b][i]x[/i]');
    expect(runs).toEqual([{ text: 'x', tags: [{ name: 'i' }] }]);
  });

  it('closes the innermost matching tag by name, not strictly by nesting order', () => {
    // [/b] closes 'b' even though 'i' opened after it and is still open.
    const runs = parseBBCodeRuns('[b][i]x[/b]y[/i]');
    expect(runs).toEqual([
      { text: 'x', tags: [{ name: 'b' }, { name: 'i' }] },
      { text: 'y', tags: [{ name: 'i' }] },
    ]);
  });

  it('returns no runs for empty text', () => {
    expect(parseBBCodeRuns('')).toEqual([]);
  });
});

describe('hasOpenTag', () => {
  it('is true when a tag of that name is open', () => {
    expect(hasOpenTag([{ name: 'b' }, { name: 'i' }], 'i')).toBe(true);
  });

  it('is false otherwise', () => {
    expect(hasOpenTag([{ name: 'b' }], 'i')).toBe(false);
  });
});

describe('lastTagValue', () => {
  it('returns the innermost (last) matching tag\'s value', () => {
    const tags = [
      { name: 'color', value: 'red' },
      { name: 'b' },
      { name: 'color', value: 'blue' },
    ];
    expect(lastTagValue(tags, 'color')).toBe('blue');
  });

  it('returns undefined when no tag of that name is open', () => {
    expect(lastTagValue([{ name: 'b' }], 'color')).toBeUndefined();
  });
});

describe('resolveBBColor', () => {
  const FALLBACK = { r: 0.1, g: 0.2, b: 0.3, a: 1 };

  it('parses a Godot Color(...) literal', () => {
    expect(resolveBBColor('Color(1, 0, 0, 1)', FALLBACK)).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('parses a 6-digit hex color (Color::html, color.cpp:331-368), alpha defaults to 1', () => {
    expect(resolveBBColor('#e0a030', FALLBACK)).toEqual({
      r: 0xe0 / 255,
      g: 0xa0 / 255,
      b: 0x30 / 255,
      a: 1,
    });
  });

  it('parses an 8-digit hex color including alpha', () => {
    const c = resolveBBColor('#e0a03080', FALLBACK);
    expect(c.r).toBeCloseTo(0xe0 / 255, 6);
    expect(c.g).toBeCloseTo(0xa0 / 255, 6);
    expect(c.b).toBeCloseTo(0x30 / 255, 6);
    expect(c.a).toBeCloseTo(0x80 / 255, 6);
  });

  it('parses a 3-digit hex shorthand', () => {
    const c = resolveBBColor('#f00', FALLBACK);
    expect(c.r).toBeCloseTo(1, 6);
    expect(c.g).toBeCloseTo(0, 6);
    expect(c.b).toBeCloseTo(0, 6);
  });

  it('accepts hex without a leading # (Color::html_is_valid, color.cpp:372-390)', () => {
    expect(resolveBBColor('e0a030', FALLBACK)).toEqual(resolveBBColor('#e0a030', FALLBACK));
  });

  it('falls back for an unrecognised name (Color::from_string\'s own fallback contract, color.cpp:450-456), not white', () => {
    expect(resolveBBColor('not-a-real-color-name', FALLBACK)).toEqual(FALLBACK);
  });
});
