import { describe, expect, it } from 'vitest';
import { parseBBCodeRuns } from './bbcode';
import { paragraphAlignment, paragraphBidiOptions } from './paragraph';

const AUTO = 0;
const LTR = 1;
const RTL = 2;
const INHERITED = 3;
const LEFT = 0;
const CENTER = 1;
const RIGHT = 2;
const FILE = 2;

const PROPS = {
  textDirection: AUTO,
  language: '',
  structuredTextBidiOverride: 0,
  structuredTextBidiOverrideOptions: [],
};
const LTR_LAYOUT = { rtl: false, locale: 'en' };

/** The tags open on the last run of `bbcode`. */
function tagsOf(bbcode: string) {
  return parseBBCodeRuns(bbcode).at(-1)!.tags;
}

describe('paragraphAlignment', () => {
  it('gives a bare [p] LEFT over the node alignment (`rich_text_label.cpp:5747`)', () => {
    expect(paragraphAlignment(tagsOf('[p]x[/p]'), RIGHT)).toBe(LEFT);
  });

  it('reads the [p align] option in both spellings (`:5790-5801`)', () => {
    expect(paragraphAlignment(tagsOf('[p align=c]x[/p]'), LEFT)).toBe(CENTER);
    expect(paragraphAlignment(tagsOf('[p align=right]x[/p]'), LEFT)).toBe(RIGHT);
  });
});

describe('paragraphBidiOptions direction, `_find_direction` (`:3507-3525`)', () => {
  function directionOf(bbcode: string, textDirection = AUTO, layout = LTR_LAYOUT): number | undefined {
    return paragraphBidiOptions(tagsOf(bbcode), { ...PROPS, textDirection }, layout).direction;
  }

  it('takes text_direction outside a paragraph, INHERITED as the layout direction', () => {
    expect(directionOf('x', RTL)).toBe(RTL);
    expect(directionOf('x', INHERITED, { rtl: true, locale: '' })).toBe(RTL);
  });

  it('reads the [p dir] option in each spelling (`:5802-5813`)', () => {
    expect(directionOf('[p dir=rtl]x[/p]')).toBe(RTL);
    expect(directionOf('[p direction=r]x[/p]', RTL)).toBe(RTL);
    expect(directionOf('[p dir=l]x[/p]', RTL)).toBe(LTR);
    expect(directionOf('[p dir=auto]x[/p]', RTL)).toBe(AUTO);
    expect(directionOf('[p dir=a]x[/p]', RTL)).toBe(AUTO);
  });

  it('lets an INHERITED paragraph take the next paragraph out, then text_direction', () => {
    expect(directionOf('[p]x[/p]', RTL)).toBe(RTL);
    expect(directionOf('[p dir=sideways]x[/p]', RTL)).toBe(RTL);
    expect(directionOf('[p dir=rtl][p]x[/p][/p]')).toBe(RTL);
  });

  it('gives an alignment tag the node direction (`:5682-5694`)', () => {
    expect(directionOf('[center]x[/center]', INHERITED, { rtl: true, locale: '' })).toBe(RTL);
  });
});

describe('paragraphBidiOptions language, `_find_language` (`:3543-3558`)', () => {
  function languageOf(bbcode: string, language = 'de'): string | undefined {
    return paragraphBidiOptions(tagsOf(bbcode), { ...PROPS, language }, LTR_LAYOUT).language;
  }

  it('takes the node language outside a paragraph, else the locale', () => {
    expect(languageOf('x')).toBe('de');
    expect(languageOf('x', '')).toBe('en');
  });

  it('gives a bare [p] no language, so it takes the locale (`:5747`)', () => {
    expect(languageOf('[p]x[/p]')).toBe('en');
  });

  it('gives a [p] with options the node language unless it sets one (`:5753,5815-5821`)', () => {
    expect(languageOf('[p dir=rtl]x[/p]')).toBe('de');
    expect(languageOf('[p lang=he]x[/p]')).toBe('he');
    expect(languageOf('[p language=he]x[/p]')).toBe('he');
  });

  it('takes the innermost [lang] or paragraph', () => {
    expect(languageOf('[p lang=he][lang=ar]x[/lang][/p]')).toBe('ar');
    expect(languageOf('[lang=ar][p lang=he]x[/p][/lang]')).toBe('he');
  });
});

describe('paragraphBidiOptions override, `_find_stt` (`:3528-3541`)', () => {
  const FILE_PROPS = { ...PROPS, structuredTextBidiOverride: FILE };
  function overrideOf(bbcode: string) {
    return paragraphBidiOptions(tagsOf(bbcode), FILE_PROPS, LTR_LAYOUT).bidiOverride;
  }

  it('takes the node override outside a paragraph and in an alignment tag', () => {
    expect(overrideOf('x')).toBeDefined();
    expect(overrideOf('[center]x[/center]')).toBeDefined();
  });

  it('gives a [p] DEFAULT unless it sets st (`:5822-5843`)', () => {
    expect(overrideOf('[p]x[/p]')).toBeUndefined();
    expect(overrideOf('[p dir=rtl]x[/p]')).toBeUndefined();
    const fileRanges = overrideOf('x')!('a/b');
    expect(paragraphBidiOptions(tagsOf('[p st=f]x[/p]'), PROPS, LTR_LAYOUT).bidiOverride!('a/b')).toEqual(
      fileRanges
    );
    expect(
      paragraphBidiOptions(tagsOf('[p bidi_override=file]x[/p]'), PROPS, LTR_LAYOUT).bidiOverride!('a/b')
    ).toEqual(fileRanges);
  });
});
