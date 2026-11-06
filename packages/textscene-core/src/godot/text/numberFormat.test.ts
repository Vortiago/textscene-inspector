import { describe, expect, it } from 'vitest';
import { formatControlNumber, formatControlPercent } from './numberFormat';

const formatNumber = (number: string, locale: string) => formatControlNumber(number, { locale });
const percentSign = (locale: string) => formatControlPercent('', { locale });

describe('formatNumber', () => {
  // Expected strings are the `num_system_data` digit rows of `core/string/locales.h:1863-1883`.
  it.each([
    ['ar', '0123456789', '٠١٢٣٤٥٦٧٨٩'],
    ['ar_EG', '12', '١٢'],
    ['fa', '0123456789', '۰۱۲۳۴۵۶۷۸۹'],
    ['bn', '0123456789', '০১২৩৪৫৬৭৮৯'],
    ['mr_IN', '10', '१०'],
    ['ff_Adlm_NG', '7', '𞥗'],
  ])('writes %s digits of %s as %s', (language, number, expected) => {
    expect(formatNumber(number, language)).toBe(expected);
  });

  it('writes the decimal point with the locale separator, as `format_number` does', () => {
    expect(formatNumber('1.5', 'ar')).toBe('١٫٥');
    expect(formatNumber('1,5', 'fa')).toBe('۱٫۵');
  });

  it('writes an exponent letter with the locale exponent', () => {
    expect(formatNumber('1e5', 'ar')).toBe('١اس٥');
    expect(formatNumber('1E5', 'fa')).toBe('۱اس۵');
    expect(formatNumber('1e5', 'bn')).toBe('১e৫');
  });

  it('keeps the digits of a locale with no number system', () => {
    expect(formatNumber('12', 'en')).toBe('12');
    expect(formatNumber('12', 'ur')).toBe('12');
    expect(formatNumber('12', 'ar-EG')).toBe('12');
  });

  it('keeps the digits for an empty locale (`translation_server.cpp:256`)', () => {
    expect(formatNumber('12', '')).toBe('12');
  });
});

describe('percentSign', () => {
  // `get_percent_sign` (`translation_server.cpp:301-312`) reads the `percent_sign` column of `locales.h:1863-1883`.
  it.each([
    ['ar', '٪'],
    ['fa_IR', '٪'],
    ['bn', '%'],
    ['en', '%'],
    ['', '%'],
  ])('writes %j as %j', (locale, expected) => {
    expect(percentSign(locale)).toBe(expected);
  });
});

describe('formatControlNumber', () => {
  it('writes the digits of the locale while localize_numeral_system is on', () => {
    expect(formatControlNumber('12', { locale: 'ar', localizeNumeralSystem: true })).toBe('١٢');
  });

  it('writes the digits of the locale when the property is unset, its default being true (`control.h:293`)', () => {
    expect(formatControlNumber('12', { locale: 'ar' })).toBe('١٢');
  });

  it('keeps the ASCII digits while the property is off', () => {
    expect(formatControlNumber('12', { locale: 'ar', localizeNumeralSystem: false })).toBe('12');
  });
});
