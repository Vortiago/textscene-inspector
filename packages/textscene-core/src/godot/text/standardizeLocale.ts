/**
 * `TranslationServer::standardize_locale` without defaults: the form `set_locale` stores for a project's
 * `internationalization/locale/test` before any control reads it.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

/** `script_list` (`core/string/locales.h`): the script codes the server keeps. */
const SCRIPT_CODES: ReadonlySet<string> = new Set([
  'Adlm',
  'Afak',
  'Aghb',
  'Ahom',
  'Arab',
  'Armi',
  'Armn',
  'Avst',
  'Bali',
  'Bamu',
  'Bass',
  'Batk',
  'Beng',
  'Bhks',
  'Blis',
  'Bopo',
  'Brah',
  'Brai',
  'Bugi',
  'Buhd',
  'Cakm',
  'Cans',
  'Cari',
  'Cham',
  'Cher',
  'Chrs',
  'Cirt',
  'Copt',
  'Cpmn',
  'Cprt',
  'Cyrl',
  'Deva',
  'Diak',
  'Dogr',
  'Dsrt',
  'Dupl',
  'Egyd',
  'Egyh',
  'Egyp',
  'Elba',
  'Elym',
  'Ethi',
  'Geok',
  'Geor',
  'Glag',
  'Gong',
  'Gonm',
  'Goth',
  'Gran',
  'Grek',
  'Gujr',
  'Guru',
  'Hang',
  'Hani',
  'Hano',
  'Hans',
  'Hant',
  'Hatr',
  'Hebr',
  'Hira',
  'Hluw',
  'Hmng',
  'Hmnp',
  'Hung',
  'Inds',
  'Ital',
  'Java',
  'Jurc',
  'Kali',
  'Kana',
  'Kawi',
  'Khar',
  'Khmr',
  'Khoj',
  'Kitl',
  'Kits',
  'Knda',
  'Kpel',
  'Kthi',
  'Lana',
  'Laoo',
  'Latn',
  'Leke',
  'Lepc',
  'Limb',
  'Lina',
  'Linb',
  'Lisu',
  'Loma',
  'Lyci',
  'Lydi',
  'Mahj',
  'Maka',
  'Mand',
  'Mani',
  'Marc',
  'Maya',
  'Medf',
  'Mend',
  'Merc',
  'Mero',
  'Mlym',
  'Modi',
  'Mong',
  'Moon',
  'Mroo',
  'Mtei',
  'Mult',
  'Mymr',
  'Nagm',
  'Nand',
  'Narb',
  'Nbat',
  'Newa',
  'Nkdb',
  'Nkgb',
  'Nkoo',
  'Nshu',
  'Ogam',
  'Olck',
  'Orkh',
  'Orya',
  'Osge',
  'Osma',
  'Ougr',
  'Palm',
  'Pauc',
  'Pcun',
  'Pelm',
  'Perm',
  'Phag',
  'Phli',
  'Phlp',
  'Phlv',
  'Phnx',
  'Piqd',
  'Plrd',
  'Prti',
  'Psin',
  'Ranj',
  'Rjng',
  'Rohg',
  'Roro',
  'Runr',
  'Samr',
  'Sara',
  'Sarb',
  'Saur',
  'Sgnw',
  'Shaw',
  'Shrd',
  'Shui',
  'Sidd',
  'Sind',
  'Sinh',
  'Sogd',
  'Sogo',
  'Sora',
  'Soyo',
  'Sund',
  'Sylo',
  'Syrc',
  'Tagb',
  'Takr',
  'Tale',
  'Talu',
  'Taml',
  'Tang',
  'Tavt',
  'Telu',
  'Teng',
  'Tfng',
  'Tglg',
  'Thaa',
  'Thai',
  'Tibt',
  'Tirh',
  'Tnsa',
  'Toto',
  'Ugar',
  'Vaii',
  'Visp',
  'Vith',
  'Wara',
  'Wcho',
  'Wole',
  'Xpeo',
  'Xsux',
  'Yezi',
  'Yiii',
  'Zanb',
]);

/** `locale_variants` (`locales.h`): each variant with the one language that owns it. */
const VARIANT_LANGUAGE: Readonly<Record<string, string>> = {
  valencia: 'ca',
  iqtelif: 'tt',
  saaho: 'aa',
  tradnl: 'es',
};

/** `locale_renames` (`locales.h`): non-ISO language names. */
const LANGUAGE_RENAMES: Readonly<Record<string, string>> = { in: 'id', iw: 'he', no: 'nb', C: 'en' };

/** `country_renames` (`locales.h`): retired country codes. */
const COUNTRY_RENAMES: Readonly<Record<string, string>> = { BU: 'MM', KV: 'XK', TP: 'TL', UK: 'GB' };

/** A script named after `@`, as `Locale::Locale` maps it (`translation_server.cpp:197-208`). */
const AT_SCRIPT_NAMES: Readonly<Record<string, string>> = {
  cyrillic: 'Cyrl',
  latin: 'Latn',
  devanagari: 'Deva',
};

const SCRIPT_PATTERN = /^[A-Z][a-z]{3}$/;
const COUNTRY_PATTERN = /^[A-Z]{2}$/;

/** The variant `candidate` names for `language`, or `undefined` when no variant of that language has the name. */
function variantOf(candidate: string, language: string): string | undefined {
  const variant = candidate.toLowerCase();
  return Object.hasOwn(VARIANT_LANGUAGE, variant) && VARIANT_LANGUAGE[variant] === language
    ? variant
    : undefined;
}

/** The script a `;`-separated list after `@` names, and the variant it names when none comes first. */
function readAtParts(parts: readonly string[], language: string): { script?: string; variant?: string } {
  let variant: string | undefined;
  for (const part of parts) {
    const name = part.toLowerCase();
    if (Object.hasOwn(AT_SCRIPT_NAMES, name)) return { script: AT_SCRIPT_NAMES[name], variant };
    variant = variantOf(part, language) ?? variant;
  }
  return { variant };
}

/** `Locale::Locale` then `operator String` (`translation_server.cpp:164-250`, `130-143`). */
export function standardizeLocale(locale: string): string {
  const universal = locale.replaceAll('-', '_');
  const [beforeAt = '', afterAt = ''] = universal.split('@');
  const elements = beforeAt.split('_');
  let language = elements[0]!;
  let script = '';
  let country = '';
  let variant = '';

  const second = elements[1];
  if (second !== undefined) {
    if (SCRIPT_PATTERN.test(second)) script = second;
    if (COUNTRY_PATTERN.test(second)) country = second;
  }
  const third = elements[2];
  if (third !== undefined) {
    if (COUNTRY_PATTERN.test(third)) country = third;
    else variant = variantOf(third, language) ?? variant;
  }
  const fourth = elements[3];
  if (fourth !== undefined) variant = variantOf(fourth, language) ?? variant;

  const atParts = readAtParts(afterAt.split(';'), language);
  script = atParts.script ?? script;
  variant = atParts.variant ?? variant;

  if (Object.hasOwn(LANGUAGE_RENAMES, language)) language = LANGUAGE_RENAMES[language]!;
  if (Object.hasOwn(COUNTRY_RENAMES, country)) country = COUNTRY_RENAMES[country]!;
  if (!SCRIPT_CODES.has(script)) script = '';

  // The language leads even when empty, so `_EG` keeps its underscore.
  return [script, country, variant].reduce((out, part) => (part === '' ? out : `${out}_${part}`), language);
}
