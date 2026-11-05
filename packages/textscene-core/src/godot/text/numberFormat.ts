/**
 * `TranslationServer::format_number`: writes the digits of a number in the numeral system of a locale.
 * A control that reads `localize_numeral_system` calls it with the language it shapes in.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

/** One row of `num_system_data` (`core/string/locales.h:1857-1883`). */
interface NumeralSystem {
  locales: string;
  /** The ten digits, then the decimal separator. */
  digits: string;
  percentSign: string;
  /** What `e` and `E` become. */
  exponent: { lower: string; upper: string };
}

const LATIN_EXPONENT = { lower: 'e', upper: 'E' };
const ARABIC_EXPONENT = { lower: 'اس', upper: 'اس' };
const ADLAM_EXPONENT = { lower: '𞤉', upper: '𞤉' };

const NUMERAL_SYSTEMS: readonly NumeralSystem[] = [
  {
    locales:
      'ar ar_AE ar_BH ar_DJ ar_EG ar_ER ar_IL ar_IQ ar_JO ar_KM ar_KW ar_LB ar_MR ar_OM ar_PS ar_QA ar_SA ar_SD ar_SO ar_SS ar_SY ar_TD ar_YE ckb ckb_IQ ckb_IR sd sd_PK sd_Arab sd_Arab_PK',
    digits: '٠١٢٣٤٥٦٧٨٩٫',
    percentSign: '٪',
    exponent: ARABIC_EXPONENT,
  },
  {
    locales:
      'fa fa_AF fa_IR ks ks_IN ks_Arab ks_Arab_IN lrc lrc_IQ lrc_IR mzn mzn_IR pa_PK pa_Arab pa_Arab_PK ps ps_AF ps_PK ur_IN uz_AF uz_Arab uz_Arab_AF',
    digits: '۰۱۲۳۴۵۶۷۸۹٫',
    percentSign: '٪',
    exponent: ARABIC_EXPONENT,
  },
  {
    locales: 'as as_IN bn bn_BD bn_IN mni mni_IN mni_Beng mni_Beng_IN',
    digits: '০১২৩৪৫৬৭৮৯.',
    percentSign: '%',
    exponent: LATIN_EXPONENT,
  },
  {
    locales: 'mr mr_IN ne ne_IN ne_NP sa sa_IN',
    digits: '०१२३४५६७८९.',
    percentSign: '%',
    exponent: LATIN_EXPONENT,
  },
  { locales: 'dz dz_BT', digits: '༠༡༢༣༤༥༦༧༨༩.', percentSign: '%', exponent: LATIN_EXPONENT },
  {
    locales: 'sat sat_IN sat_Olck sat_Olck_IN',
    digits: '᱐᱑᱒᱓᱔᱕᱖᱗᱘᱙.',
    percentSign: '%',
    exponent: LATIN_EXPONENT,
  },
  { locales: 'my my_MM', digits: '၀၁၂၃၄၅၆၇၈၉.', percentSign: '%', exponent: LATIN_EXPONENT },
  { locales: 'ccp ccp_BD ccp_IN', digits: '𑄶𑄷𑄸𑄹𑄺𑄻𑄼𑄽𑄾𑄿.', percentSign: '%', exponent: LATIN_EXPONENT },
  {
    locales:
      'ff ff_Adlm_BF ff_Adlm_CM ff_Adlm_GH ff_Adlm_GM ff_Adlm_GN ff_Adlm_GW ff_Adlm_LR ff_Adlm_MR ff_Adlm_NE ff_Adlm_NG ff_Adlm_SL ff_Adlm_SN',
    digits: '𞥐𞥑𞥒𞥓𞥔𞥕𞥖𞥗𞥘𞥙.',
    percentSign: '%',
    exponent: ADLAM_EXPONENT,
  },
];

/** A system with its digits split into code points once: some digits are astral. */
interface LoadedSystem {
  digits: readonly string[];
  separator: string;
  percentSign: string;
  exponent: NumeralSystem['exponent'];
}

/** The system of each locale, by exact match as `num_system_map` holds them (`translation_server.cpp:135-151`). */
const SYSTEM_OF_LOCALE: ReadonlyMap<string, LoadedSystem> = new Map(
  NUMERAL_SYSTEMS.flatMap((system) => {
    const characters = Array.from(system.digits);
    const loaded = {
      digits: characters.slice(0, 10),
      separator: characters[10]!,
      percentSign: system.percentSign,
      exponent: system.exponent,
    };
    return system.locales.split(' ').map((locale) => [locale, loaded] as const);
  })
);

/**
 * `format_number` (`translation_server.cpp:255-278`): `e`, `E`, each ASCII digit, `.` and `,` take the
 * locale's. An empty locale, or one with no system, returns the string as it is.
 */
export function formatNumber(number: string, locale: string): string {
  const system = SYSTEM_OF_LOCALE.get(locale);
  if (system === undefined) return number;
  return number.replace(/[0-9.,eE]/g, (character) => {
    if (character === 'e') return system.exponent.lower;
    if (character === 'E') return system.exponent.upper;
    return character === '.' || character === ',' ? system.separator : system.digits[Number(character)]!;
  });
}

/** `get_percent_sign` (`translation_server.cpp:301-312`): `%` for a locale with no system. */
export function percentSign(locale: string): string {
  return SYSTEM_OF_LOCALE.get(locale)?.percentSign ?? '%';
}

/** What a control needs to write a number: its locale and its `localize_numeral_system`. */
export interface Numerals {
  locale: string;
  /** Absent means Godot's default, true (`control.h:293`). */
  localizeNumeralSystem?: boolean;
}

/** The number as a control writes it: in the digits of `locale` unless the property is off (`is_localizing_numeral_system`). */
export function formatControlNumber(number: string, numerals: Numerals): string {
  return numerals.localizeNumeralSystem === false ? number : formatNumber(number, numerals.locale);
}

/** The percentage as `ProgressBar` writes it (`progress_bar.cpp:168-174`): the digits and the percent sign of `locale`, or `%` after ASCII digits. */
export function formatControlPercent(number: string, numerals: Numerals): string {
  const sign = numerals.localizeNumeralSystem === false ? '%' : percentSign(numerals.locale);
  return `${formatControlNumber(number, numerals)}${sign}`;
}
