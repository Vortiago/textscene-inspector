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

  it('drops a tag Godot RECOGNISES but this painter does not style, keeping it on the stack and keeping the inner text', () => {
    // `[wave]` is a real `rich_text_label.cpp:6412` tag — Godot consumes it and
    // paints `keep`. Engine-checked: `get_parsed_text()` is "keep".
    const runs = parseBBCodeRuns('[wave amp=50]keep[/wave]');
    expect(runs).toEqual([{ text: 'keep', tags: [{ name: 'wave' }] }]);
  });

  it('renders a tag Godot does NOT recognise as literal text, brackets and all', () => {
    // `rich_text_label.cpp:6526-6545`'s final else: an identifier that is
    // neither a built-in tag nor a registered custom effect emits a literal
    // "[" and re-scans from the next character, so the whole tag survives as
    // text. Its close does too — the stack is empty, so `:5385`'s close branch
    // is never entered. Engine-checked: `[nosuchtag]keep[/nosuchtag]` parses
    // to exactly itself.
    expect(parseBBCodeRuns('[nosuchtag]keep[/nosuchtag]')).toEqual([
      { text: '[nosuchtag]keep[/nosuchtag]', tags: [] },
    ]);
  });

  it('re-scans from just past the "[" of an unrecognised tag, so a real tag INSIDE one still opens', () => {
    // `pos = brk_pos + 1`, not `brk_end + 1` — Godot gives back everything but
    // the bracket. Engine-checked: `[foo[b]bar[/b]` parses to "[foobar", with
    // `bar` bold.
    expect(parseBBCodeRuns('[foo[b]bar[/b]')).toEqual([
      { text: '[foo', tags: [] },
      { text: 'bar', tags: [{ name: 'b' }] },
    ]);
  });

  it('lowercases tag names', () => {
    const runs = parseBBCodeRuns('[B]x[/B]');
    expect(runs[0]!.tags).toEqual([{ name: 'b' }]);
  });

  it('emits no run for text between two adjacent tags', () => {
    const runs = parseBBCodeRuns('[b][/b][i]x[/i]');
    expect(runs).toEqual([{ text: 'x', tags: [{ name: 'i' }] }]);
  });

  it('renders a close tag that is not the INNERMOST open tag as literal text, leaving the stack alone', () => {
    // `rich_text_label.cpp:5386,5398-5404`: `tag_ok` compares against
    // `tag_stack.front()` ONLY. `[/b]` while `i` is innermost fails that
    // check, so Godot appends "[" + "/b" as text and resumes at the "]" —
    // and both `b` and `i` stay open, which is why `y` is still styled by
    // both. Engine-checked: `[b][i]x[/b]y[/i]` parses to "x[/b]y".
    const runs = parseBBCodeRuns('[b][i]x[/b]y[/i]');
    expect(runs).toEqual([{ text: 'x[/b]y', tags: [{ name: 'b' }, { name: 'i' }] }]);
  });

  it('renders a close tag with nothing open as literal text', () => {
    // `:5385` requires a non-empty `tag_stack` to even consider a close tag.
    // Engine-checked: `a[/b]b` parses to itself.
    expect(parseBBCodeRuns('a[/b]b')).toEqual([{ text: 'a[/b]b', tags: [] }]);
  });

  it('returns no runs for empty text', () => {
    expect(parseBBCodeRuns('')).toEqual([]);
  });

  // `rich_text_label.cpp:5623-5680,5743-5745,5955`: these arms `add_text(...)`
  // and set `pos = brk_end + 1` WITHOUT reaching `tag_stack.push_front(tag)`,
  // so they never become an open tag and never need a close.
  describe('self-closing tags', () => {
    it('leaves the stack untouched, so a later close still matches its opener', () => {
      expect(parseBBCodeRuns('[b]bold[br]more[/b]')).toEqual([
        { text: 'bold\r' + 'more', tags: [{ name: 'b', value: undefined }] },
      ]);
    });

    it('emits a bare CR for [br] — `add_text("\\r")` (`:5744`), a linebreak to TextServer', () => {
      expect(parseBBCodeRuns('a[br]b')).toEqual([{ text: 'a\rb', tags: [] }]);
    });

    it('emits literal brackets for [lb] and [rb] (`:5627-5632`)', () => {
      expect(parseBBCodeRuns('[lb]b[rb]')).toEqual([{ text: '[b]', tags: [] }]);
    });

    it('emits the code point [char=hex] names (`:5623-5626`, `hex_to_int`)', () => {
      expect(parseBBCodeRuns('[char=2764]')).toEqual([{ text: '\u2764', tags: [] }]);
    });

    it('emits the Unicode control character each direction tag names (`:5633-5680`)', () => {
      expect(parseBBCodeRuns('[lrm][rlm][zwnj][shy]')).toEqual([
        { text: '\u200e\u200f\u200c\u00ad', tags: [] },
      ]);
    });

    it('consumes [hr] without opening it — `:5955` draws a rule and never pushes', () => {
      expect(parseBBCodeRuns('a[hr]b')).toEqual([{ text: 'ab', tags: [] }]);
    });

    it('still opens [p] and [img], which DO push (`:5746`, `:5992`)', () => {
      expect(parseBBCodeRuns('[p]x[/p]')).toEqual([
        { text: 'x', tags: [{ name: 'p', value: undefined }] },
      ]);
    });
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

  it('falls back for a GDScript Color(r, g, b, a) literal — real Color::from_string has no such branch', () => {
    expect(resolveBBColor('Color(1, 0, 0, 1)', FALLBACK)).toEqual(FALLBACK);
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

  it('resolves an X11 colour NAME through the same table Color::named reads', () => {
    // `Color::from_string` (`color.cpp:450-456`) tries `html` first, then
    // `named`. Engine-checked: `[color=red]R[/color]` paints red, not the
    // theme's default colour.
    expect(resolveBBColor('red', FALLBACK)).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    // A name whose normalization matters — `find_named_color` strips spaces
    // and underscores and upper-cases before matching (`color.cpp:414-415`).
    expect(resolveBBColor('Dark Orange', FALLBACK)).toEqual({ r: 1, g: 0x8c / 255, b: 0, a: 1 });
  });

  it('falls back for an unrecognised name (Color::from_string\'s own fallback contract, color.cpp:450-456), not white', () => {
    expect(resolveBBColor('not-a-real-color-name', FALLBACK)).toEqual(FALLBACK);
  });
});
