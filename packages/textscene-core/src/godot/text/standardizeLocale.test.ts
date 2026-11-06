import { describe, expect, it } from 'vitest';
import { standardizeLocale } from './standardizeLocale.js';

describe('standardizeLocale', () => {
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
