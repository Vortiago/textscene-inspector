import { describe, expect, it } from 'vitest';
import { parseBBCodeRuns } from './bbcode';
import {
  paragraphAlignment,
  paragraphBidiOptions,
  paragraphJustificationFlags,
  paragraphTabStopsPx,
} from './paragraph';
import { DEFAULT_JUSTIFICATION_FLAGS, JustificationFlag } from '../../../../godot/text/textServerEnums';

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

  it('gives a [p] with a space but no option the node language (`:5753`)', () => {
    expect(languageOf('[p x]x[/p]')).toBe('de');
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

describe('paragraphJustificationFlags, `_find_jst_flags` (`:3462-3475`)', () => {
  const NODE_FLAGS = JustificationFlag.TRIM_EDGE_SPACES;
  const flagsOf = (bbcode: string, nodeFlags = NODE_FLAGS): number =>
    paragraphJustificationFlags(tagsOf(bbcode), nodeFlags);

  it('takes the node flags outside a paragraph and in an alignment tag (`:5682-5694`)', () => {
    expect(flagsOf('x')).toBe(NODE_FLAGS);
    expect(flagsOf('[fill]x[/fill]')).toBe(NODE_FLAGS);
  });

  it('gives a bare [p] the header default, not the node flags (`rich_text_label.h:849`)', () => {
    expect(flagsOf('[p]x[/p]')).toBe(DEFAULT_JUSTIFICATION_FLAGS);
  });

  it('gives a [p] with other options the node flags (`:5753`)', () => {
    expect(flagsOf('[p align=f]x[/p]')).toBe(NODE_FLAGS);
  });

  it('starts from no flags and sets one per token in each spelling (`:5758-5782`)', () => {
    expect(flagsOf('[p jst=w]x[/p]')).toBe(JustificationFlag.WORD_BOUND);
    expect(flagsOf('[p justification_flags=kashida,trim]x[/p]')).toBe(
      JustificationFlag.KASHIDA | JustificationFlag.TRIM_EDGE_SPACES
    );
    expect(flagsOf('[p jst=lt,sl,sv,ns]x[/p]')).toBe(
      JustificationFlag.AFTER_LAST_TAB |
        JustificationFlag.SKIP_LAST_LINE |
        JustificationFlag.SKIP_LAST_LINE_WITH_VISIBLE_CHARS |
        JustificationFlag.DO_NOT_SKIP_SINGLE_LINE
    );
    expect(
      flagsOf('[p jst=after_last_tab,skip_last,skip_last_with_chars,do_not_skip_single,word,k]x[/p]')
    ).toBe(
      JustificationFlag.AFTER_LAST_TAB |
        JustificationFlag.SKIP_LAST_LINE |
        JustificationFlag.SKIP_LAST_LINE_WITH_VISIBLE_CHARS |
        JustificationFlag.DO_NOT_SKIP_SINGLE_LINE |
        JustificationFlag.WORD_BOUND |
        JustificationFlag.KASHIDA
    );
  });

  it('prefers the long option over the short one, and ignores an unknown token', () => {
    expect(flagsOf('[p jst=w justification_flags=k]x[/p]')).toBe(JustificationFlag.KASHIDA);
    expect(flagsOf('[p jst=w,bogus]x[/p]')).toBe(JustificationFlag.WORD_BOUND);
    expect(flagsOf('[p jst=]x[/p]')).toBe(JustificationFlag.NONE);
  });

  it('reads the innermost paragraph', () => {
    expect(flagsOf('[p jst=w][p jst=k]x[/p][/p]')).toBe(JustificationFlag.KASHIDA);
    expect(flagsOf('[p jst=w][fill]x[/fill][/p]')).toBe(NODE_FLAGS);
  });
});

describe('paragraphTabStopsPx, `_find_tab_stops` (`:3477-3490`)', () => {
  const NODE_STOPS = [30];
  const stopsOf = (bbcode: string): number[] => paragraphTabStopsPx(tagsOf(bbcode), NODE_STOPS);

  it('takes the node stops outside a paragraph and in an alignment tag', () => {
    expect(stopsOf('x')).toEqual(NODE_STOPS);
    expect(stopsOf('[center]x[/center]')).toEqual(NODE_STOPS);
  });

  it('gives a bare [p] no stops, so it falls to tab_size (`:5747`)', () => {
    expect(stopsOf('[p]x[/p]')).toEqual([]);
  });

  it('gives a [p] with other options the node stops (`:5753`)', () => {
    expect(stopsOf('[p align=c]x[/p]')).toEqual(NODE_STOPS);
  });

  it('splits tab_stops on commas and semicolons into floats (`:5783-5789`)', () => {
    expect(stopsOf('[p tab_stops=40,120]x[/p]')).toEqual([40, 120]);
    expect(stopsOf('[p tab_stops="12.5;7,3"]x[/p]')).toEqual([12.5, 7, 3]);
  });

  it('keeps an empty piece as 0, as `split_floats_mk` allows empty (`ustring.cpp:1243`)', () => {
    expect(stopsOf('[p tab_stops="4,,9"]x[/p]')).toEqual([4, 0, 9]);
    expect(stopsOf('[p tab_stops=""]x[/p]')).toEqual([]);
  });
});

/** `add_hr` pushes an `ItemParagraph` with the struct defaults (`rich_text_label.h:369-377`), not the node's. */
describe('the [hr] paragraph', () => {
  const NODE_FLAGS = JustificationFlag.TRIM_EDGE_SPACES;
  const hrTags = (bbcode: string) => parseBBCodeRuns(bbcode).find((run) => run.rule)!.tags;

  it('aligns by its align option, CENTER by default (`:5957-5966`)', () => {
    expect(paragraphAlignment(hrTags('[hr]'), LEFT)).toBe(CENTER);
    expect(paragraphAlignment(hrTags('[hr align=right]'), LEFT)).toBe(RIGHT);
    expect(paragraphAlignment(hrTags('[hr align=l]'), RIGHT)).toBe(LEFT);
  });

  it('takes direction AUTO and the locale as language, whatever the node sets', () => {
    const options = paragraphBidiOptions(
      hrTags('[hr]'),
      { ...PROPS, textDirection: RTL, language: 'de' },
      LTR_LAYOUT
    );
    expect(options.direction).toBe(AUTO);
    expect(options.language).toBe('en');
  });

  it('takes the header justification flags and no tab stops', () => {
    expect(paragraphJustificationFlags(hrTags('[hr]'), NODE_FLAGS)).toBe(DEFAULT_JUSTIFICATION_FLAGS);
    expect(paragraphTabStopsPx(hrTags('[hr]'), [30])).toEqual([]);
  });
});
