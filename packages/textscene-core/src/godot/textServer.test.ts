import { describe, it, expect } from 'vitest';
import { isLocaleRightToLeft, RTL_LANGUAGE_CODES } from './textServer.js';

describe('isLocaleRightToLeft', () => {
  it('answers true for each of the seven language codes the table lists', () => {
    // `TextServerAdvanced::_is_locale_right_to_left`
    // (`modules/text_server_adv/text_server_adv.cpp:534-541`):
    //   if ((l == "ar") || (l == "dv") || (l == "he") || (l == "fa") ||
    //       (l == "ff") || (l == "ku") || (l == "ur")) return true;
    expect([...RTL_LANGUAGE_CODES]).toEqual(['ar', 'dv', 'he', 'fa', 'ff', 'ku', 'ur']);
    for (const code of RTL_LANGUAGE_CODES) {
      expect(isLocaleRightToLeft(code), code).toBe(true);
    }
  });

  it('reads the language subtag alone, so a country or script suffix still matches', () => {
    // `String l = p_locale.get_slicec('_', 0);` (`text_server_adv.cpp:535`).
    expect(isLocaleRightToLeft('he_IL')).toBe(true);
    expect(isLocaleRightToLeft('ar_Arab_EG')).toBe(true);
  });

  it("standardises macOS's dash spelling and drops an @variant before slicing", () => {
    // `String univ_locale = p_locale.replace_char('-', '_');` then
    // `univ_locale.get_slicec('@', 0).split("_")`
    // (`core/string/translation_server.cpp:171-175`) — `set_locale` stores the
    // standardised form, which is what the table above is handed.
    expect(isLocaleRightToLeft('fa-IR')).toBe(true);
    expect(isLocaleRightToLeft('ur_PK@variant')).toBe(true);
  });

  it('answers false for a left-to-right locale, an empty string and a longer word starting with a listed code', () => {
    expect(isLocaleRightToLeft('en')).toBe(false);
    expect(isLocaleRightToLeft('en_US')).toBe(false);
    expect(isLocaleRightToLeft('')).toBe(false);
    // `l == "ar"` is equality, not a prefix test: `arn` (Mapudungun) is LTR.
    expect(isLocaleRightToLeft('arn')).toBe(false);
    // The table is lower-case and the engine never case-folds the subtag.
    expect(isLocaleRightToLeft('AR')).toBe(false);
  });
});
