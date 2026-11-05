/**
 * `TranslationServer::format_number`: writes the digits of a number in the numeral system of a locale.
 * A control that reads `localize_numeral_system` calls it with the language it shapes in.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

/** One row of `num_system_data` (`core/string/locales.h:1857-1883`), less the percent sign no caller reads yet. */
interface NumeralSystem {
  locales: string;
  /** The ten digits, then the decimal separator. */
  digits: string;
  lowerExponent: string;
  upperExponent: string;
}

const NUMERAL_SYSTEMS: readonly NumeralSystem[] = [
  {
    locales:
      'ar ar_AE ar_BH ar_DJ ar_EG ar_ER ar_IL ar_IQ ar_JO ar_KM ar_KW ar_LB ar_MR ar_OM ar_PS ar_QA ar_SA ar_SD ar_SO ar_SS ar_SY ar_TD ar_YE ckb ckb_IQ ckb_IR sd sd_PK sd_Arab sd_Arab_PK',
    digits: '٠١٢٣٤٥٦٧٨٩٫',
    lowerExponent: 'اس',
    upperExponent: 'اس',
  },
  {
    locales:
      'fa fa_AF fa_IR ks ks_IN ks_Arab ks_Arab_IN lrc lrc_IQ lrc_IR mzn mzn_IR pa_PK pa_Arab pa_Arab_PK ps ps_AF ps_PK ur_IN uz_AF uz_Arab uz_Arab_AF',
    digits: '۰۱۲۳۴۵۶۷۸۹٫',
    lowerExponent: 'اس',
    upperExponent: 'اس',
  },
  {
    locales: 'as as_IN bn bn_BD bn_IN mni mni_IN mni_Beng mni_Beng_IN',
    digits: '০১২৩৪৫৬৭৮৯.',
    lowerExponent: 'e',
    upperExponent: 'E',
  },
  {
    locales: 'mr mr_IN ne ne_IN ne_NP sa sa_IN',
    digits: '०१२३४५६७८९.',
    lowerExponent: 'e',
    upperExponent: 'E',
  },
  { locales: 'dz dz_BT', digits: '༠༡༢༣༤༥༦༧༨༩.', lowerExponent: 'e', upperExponent: 'E' },
  {
    locales: 'sat sat_IN sat_Olck sat_Olck_IN',
    digits: '᱐᱑᱒᱓᱔᱕᱖᱗᱘᱙.',
    lowerExponent: 'e',
    upperExponent: 'E',
  },
  { locales: 'my my_MM', digits: '၀၁၂၃၄၅၆၇၈၉.', lowerExponent: 'e', upperExponent: 'E' },
  { locales: 'ccp ccp_BD ccp_IN', digits: '𑄶𑄷𑄸𑄹𑄺𑄻𑄼𑄽𑄾𑄿.', lowerExponent: 'e', upperExponent: 'E' },
  {
    locales:
      'ff ff_Adlm_BF ff_Adlm_CM ff_Adlm_GH ff_Adlm_GM ff_Adlm_GN ff_Adlm_GW ff_Adlm_LR ff_Adlm_MR ff_Adlm_NE ff_Adlm_NG ff_Adlm_SL ff_Adlm_SN',
    digits: '𞥐𞥑𞥒𞥓𞥔𞥕𞥖𞥗𞥘𞥙.',
    lowerExponent: '𞤉',
    upperExponent: '𞤉',
  },
];

/** The system of each locale, by exact match as `num_system_map` holds them (`translation_server.cpp:135-151`). */
const SYSTEM_OF_LOCALE: ReadonlyMap<string, NumeralSystem> = new Map(
  NUMERAL_SYSTEMS.flatMap((system) => system.locales.split(' ').map((locale) => [locale, system] as const))
);

/**
 * `format_number` (`translation_server.cpp:255-278`): the exponent letters, then each ASCII digit, and
 * `.` or `,`, take the locale's. An empty locale, or one with no system, returns the string as it is.
 */
export function formatNumber(number: string, locale: string): string {
  const system = SYSTEM_OF_LOCALE.get(locale);
  if (system === undefined) return number;
  const digits = Array.from(system.digits);
  return number
    .replaceAll('e', system.lowerExponent)
    .replaceAll('E', system.upperExponent)
    .replace(/[0-9.,]/g, (character) =>
      character === '.' || character === ',' ? digits[10]! : digits[Number(character)]!
    );
}
