/**
 * Tests the framework-free BBCode tokenizer: `parseBBCodeRuns`, `hasOpenTag`,
 * `lastTagValue`, `resolveBBColor` and `parseImgTag`.
 */
import { describe, expect, it } from 'vitest';
import { IMAGE_OBJECT_CHAR, hasOpenTag, lastTagValue, parseBBCodeRuns, parseImgTag, resolveBBColor } from './bbcode';

const WHITE = { r: 1, g: 1, b: 1, a: 1 };
const CENTER_CENTER = { imagePoint: 'center', textPoint: 'center' } as const;

/** A `ParsedImgTag` with every field at its Godot default but `path` and the overrides. */
function img(path: string, overrides: Partial<ReturnType<typeof parseImgTag>> = {}) {
  return {
    path,
    width: 0,
    height: 0,
    widthInPercent: false,
    heightInPercent: false,
    color: WHITE,
    region: undefined,
    pad: false,
    tooltip: '',
    altText: '',
    alignment: CENTER_CENTER,
    ...overrides,
  };
}

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
    // `[wave]` is a real `rich_text_label.cpp:6412` tag: Godot consumes it, and
    // `get_parsed_text()` is "keep".
    const runs = parseBBCodeRuns('[wave amp=50]keep[/wave]');
    expect(runs).toEqual([{ text: 'keep', tags: [{ name: 'wave' }] }]);
  });

  it('renders a tag Godot does NOT recognise as literal text, brackets and all', () => {
    // `rich_text_label.cpp:6526-6545`'s final else emits a literal "[" for an
    // unknown identifier and re-scans from the next character. The close
    // survives too, since `:5385` needs a non-empty stack. In Godot,
    // `[nosuchtag]keep[/nosuchtag]` parses to itself.
    expect(parseBBCodeRuns('[nosuchtag]keep[/nosuchtag]')).toEqual([
      { text: '[nosuchtag]keep[/nosuchtag]', tags: [] },
    ]);
  });

  it('re-scans from just past the "[" of an unrecognised tag, so a real tag INSIDE one still opens', () => {
    // `pos = brk_pos + 1`, not `brk_end + 1`: in Godot `[foo[b]bar[/b]` parses
    // to "[foobar", with `bar` bold.
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
    // `rich_text_label.cpp:5386,5398-5404`: `tag_ok` compares only against
    // `tag_stack.front()`, so `[/b]` under `i` is text and both tags stay open.
    // In Godot, `[b][i]x[/b]y[/i]` parses to "x[/b]y".
    const runs = parseBBCodeRuns('[b][i]x[/b]y[/i]');
    expect(runs).toEqual([{ text: 'x[/b]y', tags: [{ name: 'b' }, { name: 'i' }] }]);
  });

  it('renders a close tag with nothing open as literal text', () => {
    // `:5385` requires a non-empty `tag_stack` to consider a close tag. In
    // Godot, `a[/b]b` parses to itself.
    expect(parseBBCodeRuns('a[/b]b')).toEqual([{ text: 'a[/b]b', tags: [] }]);
  });

  it('returns no runs for empty text', () => {
    expect(parseBBCodeRuns('')).toEqual([]);
  });

  // `rich_text_label.cpp:5623-5680,5743-5745,5955`: these arms add text and
  // never reach `tag_stack.push_front(tag)`, so they need no close.
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

    // A surrogate code point is not a scalar value, so `String.fromCodePoint`
    // would emit a lone surrogate.
    it('emits nothing for a surrogate [char=], which is in range but has no scalar value', () => {
      expect(parseBBCodeRuns('[char=D800]')).toEqual([]);
      expect(parseBBCodeRuns('[char=DFFF]')).toEqual([]);
    });

    it('still emits an astral code point, which is above the surrogate range', () => {
      expect(parseBBCodeRuns('[char=1F600]')).toEqual([{ text: '\u{1F600}', tags: [] }]);
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

  /**
   * `[img]`'s payload is a resource path (`:6026-6031,6145`), never text. It
   * becomes one `IMAGE_OBJECT_CHAR` run carrying the parsed tag, as Godot's
   * `String::chr(0xfffc)` placeholder stands in for `ItemImage`.
   */
  describe('[img]', () => {
    it('reads its payload as the image path, captured on the run rather than printed as text', () => {
      expect(parseBBCodeRuns('a[img=80]res://logo.png[/img]b')).toEqual([
        { text: 'a', tags: [] },
        { text: IMAGE_OBJECT_CHAR, tags: [], image: img('res://logo.png', { width: 80 }) },
        { text: 'b', tags: [] },
      ]);
    });

    it('runs the path to the end when no bracket closes it (`:6027-6029`)', () => {
      expect(parseBBCodeRuns('a[img]res://logo.png')).toEqual([
        { text: 'a', tags: [] },
        { text: IMAGE_OBJECT_CHAR, tags: [], image: img('res://logo.png') },
      ]);
    });

    it('keeps text after the close tag outside the image, and outside its OWN (unconditionally pushed) tag context', () => {
      expect(parseBBCodeRuns('[b][img]a.png[/img]x[/b]')).toEqual([
        { text: IMAGE_OBJECT_CHAR, tags: [{ name: 'b', value: undefined }], image: img('a.png') },
        { text: 'x', tags: [{ name: 'b', value: undefined }] },
      ]);
    });

    it('emits no run at all for an empty path — the same "texture failed to load" outcome real Godot reaches (`:6034`)', () => {
      expect(parseBBCodeRuns('a[img][/img]b')).toEqual([{ text: 'ab', tags: [] }]);
    });
  });
});

describe('parseImgTag', () => {
  it('parses "WxH" from the value form (`:6062-6071`)', () => {
    expect(parseImgTag('img=100x50', 'a.png')).toEqual(img('a.png', { width: 100, height: 50 }));
  });

  it('parses a bare width, no "x", as width-only — height stays 0 (natural aspect)', () => {
    expect(parseImgTag('img=64', 'a.png')).toEqual(img('a.png', { width: 64 }));
  });

  it('reads a "%" suffix on either half of "WxH" independently', () => {
    expect(parseImgTag('img=50%x25', 'a.png')).toEqual(
      img('a.png', { width: 50, widthInPercent: true, height: 25 })
    );
  });

  it('reads width/height from bbcode_options ONLY when the value form is absent (`:6072-6141`)', () => {
    expect(parseImgTag('img width=40 height=30', 'a.png')).toEqual(img('a.png', { width: 40, height: 30 }));
  });

  it('the value form and the width=/height= options are mutually exclusive — a present value form leaves the options unread even when both are written', () => {
    // `"top".to_int()` is 0 (`String::to_int` skips non-digits), so width and
    // height stay 0 rather than falling through to `width=`.
    expect(parseImgTag('img=top width=999', 'a.png')).toEqual(img('a.png', { alignment: { imagePoint: 'top', textPoint: 'top' } }));
  });

  it('reads tooltip=/pad= only from the options form', () => {
    expect(parseImgTag('img tooltip="a caption" pad=true', 'a.png')).toEqual(
      img('a.png', { tooltip: 'a caption', pad: true })
    );
  });

  it('reads color=/region=/alt= unconditionally, alongside EITHER form', () => {
    expect(parseImgTag('img=32x32 color=#ff0000 region=1,2,3,4 alt="a logo"', 'a.png')).toEqual(
      img('a.png', {
        width: 32,
        height: 32,
        color: { r: 1, g: 0, b: 0, a: 1 },
        region: { x: 1, y: 2, w: 3, h: 4 },
        altText: 'a logo',
      })
    );
  });

  it('color falls back to opaque white, not the paragraph default_color (`:6034-6038`)', () => {
    expect(parseImgTag('img', 'a.png').color).toEqual(WHITE);
  });

  it('a malformed region (not exactly 4 comma-separated values) is dropped', () => {
    expect(parseImgTag('img region=1,2,3', 'a.png').region).toBeUndefined();
  });

  it('an unterminated quote still yields its tail piece (`_split_unquoted`, `:5290-5296`) — unquote is a no-op on an unmatched pair', () => {
    expect(parseImgTag('img alt="unclosed', 'a.png').altText).toBe('"unclosed');
  });

  describe('alignment', () => {
    it('a single subtag sets a full preset — image point and text point together (`:6001-6010`)', () => {
      expect(parseImgTag('img=top', 'a.png').alignment).toEqual({ imagePoint: 'top', textPoint: 'top' });
      expect(parseImgTag('img=bottom', 'a.png').alignment).toEqual({ imagePoint: 'bottom', textPoint: 'bottom' });
    });

    it('a two-piece subtag sets each axis independently', () => {
      expect(parseImgTag('img=top,bottom', 'a.png').alignment).toEqual({ imagePoint: 'top', textPoint: 'bottom' });
    });

    it('a matched image-point piece resets text-point to top unless the second piece also matches — Godot assigns (not ORs) the image bits, zeroing the text bits as a side effect', () => {
      expect(parseImgTag('img=top,xyz', 'a.png').alignment).toEqual({ imagePoint: 'top', textPoint: 'top' });
    });

    it("an unmatched image-point piece leaves text-point BOTTOM for 'baseline' — the default CENTER text field (0b01) OR'd with BASELINE's own field (0b10) is 0b11, Godot's own BOTTOM value, a real engine quirk this ports bit-for-bit", () => {
      expect(parseImgTag('img=xyz,baseline', 'a.png').alignment).toEqual({ imagePoint: 'center', textPoint: 'bottom' });
    });

    it('reads align= from the options form, using the same subtag grammar', () => {
      expect(parseImgTag('img align=bottom,center', 'a.png').alignment).toEqual({ imagePoint: 'bottom', textPoint: 'center' });
    });

    it('align= is unread once the value form is present, same mutual exclusivity as width/height', () => {
      expect(parseImgTag('img=32 align=bottom', 'a.png').alignment).toEqual(CENTER_CENTER);
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
    // `Color::from_string` (`color.cpp:450-456`) tries `html`, then `named`.
    // In Godot, `[color=red]R[/color]` paints red.
    expect(resolveBBColor('red', FALLBACK)).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    // `find_named_color` strips spaces and underscores and upper-cases before
    // matching (`color.cpp:414-415`).
    expect(resolveBBColor('Dark Orange', FALLBACK)).toEqual({ r: 1, g: 0x8c / 255, b: 0, a: 1 });
  });

  it('falls back for an unrecognised name (Color::from_string\'s own fallback contract, color.cpp:450-456), not white', () => {
    expect(resolveBBColor('not-a-real-color-name', FALLBACK)).toEqual(FALLBACK);
  });
});
