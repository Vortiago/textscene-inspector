import { describe, expect, it } from 'vitest';
import { controlBidiOptions, textBidiOptions, isDrawnRtl } from './textBidiOptions';

const AUTO = 0;
const LTR = 1;
const RTL = 2;
const INHERITED = 3;

describe('controlBidiOptions', () => {
  it('turns INHERITED into the layout direction', () => {
    const props = { textDirection: INHERITED, language: '' };
    expect(controlBidiOptions(props, { rtl: true, locale: '' }).direction).toBe(RTL);
    expect(controlBidiOptions(props, { rtl: false, locale: '' }).direction).toBe(LTR);
  });

  it('takes the locale for an empty language', () => {
    expect(
      controlBidiOptions({ textDirection: AUTO, language: '' }, { rtl: false, locale: 'he' }).language
    ).toBe('he');
  });
});

describe('textBidiOptions', () => {
  it('passes INHERITED through, which the text server reads as AUTO', () => {
    expect(textBidiOptions({ textDirection: INHERITED, language: '' }, '').direction).toBe(INHERITED);
  });

  it('gives no override ranges for DEFAULT or a type without the property', () => {
    expect(textBidiOptions({ textDirection: AUTO, language: '' }, '').bidiOverride).toBeUndefined();
    const defaultParser = { structuredTextBidiOverride: 0, structuredTextBidiOverrideOptions: [] };
    expect(
      textBidiOptions({ textDirection: AUTO, language: '', ...defaultParser }, '').bidiOverride
    ).toBeUndefined();
  });

  it('gives the FILE ranges of the text', () => {
    const file = { structuredTextBidiOverride: 2, structuredTextBidiOverrideOptions: [] };
    const { bidiOverride } = textBidiOptions({ textDirection: AUTO, language: '', ...file }, '');
    expect(bidiOverride!('a/b')).toHaveLength(3);
  });
});

describe('isDrawnRtl', () => {
  it('draws right to left only when the set direction is RTL', () => {
    expect(isDrawnRtl({ direction: RTL })).toBe(true);
    expect(isDrawnRtl({ direction: AUTO })).toBe(false);
    expect(isDrawnRtl({ direction: LTR })).toBe(false);
  });
});
