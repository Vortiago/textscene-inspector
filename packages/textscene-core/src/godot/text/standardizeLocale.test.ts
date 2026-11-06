import { describe, expect, it } from 'vitest';
import { standardizeLocale } from './standardizeLocale.js';

describe('standardizeLocale', () => {
  it('turns a hyphen into an underscore (`translation_server.cpp:167`)', () => {
    expect(standardizeLocale('ar-EG')).toBe('ar_EG');
    expect(standardizeLocale('fa-IR')).toBe('fa_IR');
  });

  it('keeps the language as written, so `AR` is not lower-cased', () => {
    // Godot copies `locale_elements[0]` without a case change.
    expect(standardizeLocale('AR')).toBe('AR');
  });

  it('keeps a script of four letters and a country of two capitals', () => {
    expect(standardizeLocale('zh-Hans-CN')).toBe('zh_Hans_CN');
    expect(standardizeLocale('sd_Arab_PK')).toBe('sd_Arab_PK');
  });

  it('drops a country in lower case, a script outside the table and a segment that is neither', () => {
    expect(standardizeLocale('ar_eg')).toBe('ar');
    expect(standardizeLocale('sr_Xxxx_RS')).toBe('sr_RS');
    expect(standardizeLocale('en_US_extra')).toBe('en_US');
  });

  it('renames a non-ISO language and a retired country', () => {
    expect(standardizeLocale('iw')).toBe('he');
    expect(standardizeLocale('C')).toBe('en');
    expect(standardizeLocale('en_UK')).toBe('en_GB');
  });

  it('reads a variant after the country, or after `@`, only for its own language', () => {
    expect(standardizeLocale('ca_ES_valencia')).toBe('ca_ES_valencia');
    expect(standardizeLocale('ca_ES@valencia')).toBe('ca_ES_valencia');
    expect(standardizeLocale('en_US_valencia')).toBe('en_US');
  });

  it('reads a script name after `@`', () => {
    expect(standardizeLocale('sr@latin')).toBe('sr_Latn');
    expect(standardizeLocale('sr_RS@cyrillic')).toBe('sr_Cyrl_RS');
  });

  // Measured with `TranslationServer.standardize_locale(input)` in Godot 4.6.3.
  it.each([
    ['ar-EG', 'ar_EG'],
    ['AR', 'AR'],
    ['fa-IR', 'fa_IR'],
    ['zh-Hans-CN', 'zh_Hans_CN'],
    ['sd_Arab_PK', 'sd_Arab_PK'],
    ['ar_eg', 'ar'],
    ['sr_Xxxx_RS', 'sr_RS'],
    ['en_US_extra', 'en_US'],
    ['iw', 'he'],
    ['C', 'en'],
    ['en_UK', 'en_GB'],
    ['ca_ES_valencia', 'ca_ES_valencia'],
    ['ca_ES@valencia', 'ca_ES_valencia'],
    ['en_US_valencia', 'en_US'],
    ['sr@latin', 'sr_Latn'],
    ['sr_RS@cyrillic', 'sr_Cyrl_RS'],
    ['sr@devanagari', 'sr_Deva'],
    ['ca_ES@valencia;latin', 'ca_Latn_ES_valencia'],
    ['en-GB@euro', 'en_GB'],
    ['ff_Adlm_NG', 'ff_Adlm_NG'],
    ['pt_BR.UTF-8', 'pt'],
    ['ar_EG@foo', 'ar_EG'],
    ['_EG', '_EG'],
    ['', ''],
    ['no_NO', 'nb_NO'],
    ['en_BU', 'en_MM'],
  ])('answers as Godot does for %j', (input, expected) => {
    expect(standardizeLocale(input)).toBe(expected);
  });
});
