/**
 * The scripts of FreeType's auto-hinter (`afscript.h`, `afranges.c`): the characters each covers,
 * those of them that sit on a base glyph, whether its vertical stems hint from the top, the
 * characters whose stems give its standard widths, and the OpenType script tags HarfBuzz gives it
 * (`hb_ot_tags_from_script_and_language`), newest first.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 2013-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

export interface AutofitScript {
  readonly name: string;
  readonly openTypeTags: readonly string[];
  readonly isTopToBottom: boolean;
  /** Clusters separated by spaces. */
  readonly standardCharacters: string;
  /** Pairs of first and last code point. */
  readonly ranges: readonly number[];
  readonly nonbaseRanges: readonly number[];
}

export const AUTOFIT_SCRIPTS: readonly AutofitScript[] = [
  {
    name: 'adlm',
    openTypeTags: ['adlm'],
    isTopToBottom: false,
    standardCharacters: '\u{1e90c} \u{1e92e}',
    ranges: [0x1e900, 0x1e95f],
    nonbaseRanges: [0x1d944, 0x1e94a],
  },
  {
    name: 'arab',
    openTypeTags: ['arab'],
    isTopToBottom: false,
    standardCharacters: '\u0644 \u062d \u0640',
    ranges: [
      0x600, 0x6ff, 0x750, 0x7ff, 0x870, 0x89f, 0x8a0, 0x8ff, 0xfb50, 0xfdff, 0xfe70, 0xfeff, 0x10ec0,
      0x10eff, 0x1ee00, 0x1eeff,
    ],
    nonbaseRanges: [
      0x600, 0x605, 0x610, 0x61a, 0x64b, 0x65f, 0x670, 0x670, 0x6d6, 0x6dc, 0x6df, 0x6e4, 0x6e7, 0x6e8, 0x6ea,
      0x6ed, 0x897, 0x89f, 0x8ca, 0x8e1, 0x8e3, 0x8ff, 0xfbb2, 0xfbc1, 0xfe70, 0xfe70, 0xfe72, 0xfe72, 0xfe74,
      0xfe74, 0xfe76, 0xfe76, 0xfe78, 0xfe78, 0xfe7a, 0xfe7a, 0xfe7c, 0xfe7c, 0xfe7e, 0xfe7e, 0x10efd,
      0x10eff,
    ],
  },
  {
    name: 'armn',
    openTypeTags: ['armn'],
    isTopToBottom: false,
    standardCharacters: '\u057d \u054d',
    ranges: [0x530, 0x58f, 0xfb13, 0xfb17],
    nonbaseRanges: [0x559, 0x55f],
  },
  {
    name: 'avst',
    openTypeTags: ['avst'],
    isTopToBottom: false,
    standardCharacters: '\u{10b1a}',
    ranges: [0x10b00, 0x10b3f],
    nonbaseRanges: [0x10b39, 0x10b3f],
  },
  {
    name: 'bamu',
    openTypeTags: ['bamu'],
    isTopToBottom: false,
    standardCharacters: '\ua6c1 \ua6ef',
    ranges: [0xa6a0, 0xa6ff],
    nonbaseRanges: [0xa6f0, 0xa6f1],
  },
  {
    name: 'beng',
    openTypeTags: ['bng3', 'bng2', 'beng'],
    isTopToBottom: true,
    standardCharacters: '\u09e6 \u09ea',
    ranges: [0x980, 0x9ff],
    nonbaseRanges: [0x981, 0x981, 0x9bc, 0x9bc, 0x9c1, 0x9c4, 0x9cd, 0x9cd, 0x9e2, 0x9e3, 0x9fe, 0x9fe],
  },
  {
    name: 'buhd',
    openTypeTags: ['buhd'],
    isTopToBottom: false,
    standardCharacters: '\u174b \u174f',
    ranges: [0x1740, 0x175f],
    nonbaseRanges: [0x1752, 0x1753],
  },
  {
    name: 'cakm',
    openTypeTags: ['cakm'],
    isTopToBottom: false,
    standardCharacters: '\u{11124} \u{11109} \u{1111b}',
    ranges: [0x11100, 0x1114f],
    nonbaseRanges: [0x11100, 0x11102, 0x11127, 0x11134, 0x11146, 0x11146],
  },
  {
    name: 'cans',
    openTypeTags: ['cans'],
    isTopToBottom: false,
    standardCharacters: '\u144c \u14da',
    ranges: [0x1400, 0x167f, 0x18b0, 0x18ff, 0x11ab0, 0x11abf],
    nonbaseRanges: [],
  },
  {
    name: 'cari',
    openTypeTags: ['cari'],
    isTopToBottom: false,
    standardCharacters: '\u{102ab} \u{102c9}',
    ranges: [0x102a0, 0x102df],
    nonbaseRanges: [],
  },
  {
    name: 'cher',
    openTypeTags: ['cher'],
    isTopToBottom: false,
    standardCharacters: '\u13a4 \u13c5 \uab95',
    ranges: [0x13a0, 0x13ff, 0xab70, 0xabbf],
    nonbaseRanges: [],
  },
  {
    name: 'copt',
    openTypeTags: ['copt'],
    isTopToBottom: false,
    standardCharacters: '\u2c9e \u2c9f',
    ranges: [0x2c80, 0x2cff],
    nonbaseRanges: [0x2cef, 0x2cf1],
  },
  {
    name: 'cprt',
    openTypeTags: ['cprt'],
    isTopToBottom: false,
    standardCharacters: '\u{10805} \u{10823}',
    ranges: [0x10800, 0x1083f],
    nonbaseRanges: [],
  },
  {
    name: 'cyrl',
    openTypeTags: ['cyrl'],
    isTopToBottom: false,
    standardCharacters: '\u043e \u041e',
    ranges: [0x400, 0x4ff, 0x500, 0x52f, 0x2de0, 0x2dff, 0xa640, 0xa69f, 0x1c80, 0x1c8f, 0x1e030, 0x1e08f],
    nonbaseRanges: [0x483, 0x489, 0x2de0, 0x2dff, 0xa66f, 0xa67f, 0xa69e, 0xa69f],
  },
  {
    name: 'deva',
    openTypeTags: ['dev3', 'dev2', 'deva'],
    isTopToBottom: true,
    standardCharacters: '\u0920 \u0935 \u091f',
    ranges: [
      0x900, 0x93b, 0x93d, 0x950, 0x953, 0x963, 0x966, 0x97f, 0x20b9, 0x20b9, 0xa8e0, 0xa8ff, 0x11b00,
      0x11b5f,
    ],
    nonbaseRanges: [
      0x900, 0x902, 0x93a, 0x93a, 0x941, 0x948, 0x94d, 0x94d, 0x953, 0x957, 0x962, 0x963, 0xa8e0, 0xa8f1,
      0xa8ff, 0xa8ff,
    ],
  },
  {
    name: 'dsrt',
    openTypeTags: ['dsrt'],
    isTopToBottom: false,
    standardCharacters: '\u{10404} \u{1042c}',
    ranges: [0x10400, 0x1044f],
    nonbaseRanges: [],
  },
  {
    name: 'ethi',
    openTypeTags: ['ethi'],
    isTopToBottom: false,
    standardCharacters: '\u12d0',
    ranges: [0x1200, 0x137f, 0x1380, 0x139f, 0x2d80, 0x2ddf, 0xab00, 0xab2f, 0x1e7e0, 0x1e7ff],
    nonbaseRanges: [0x135d, 0x135f],
  },
  {
    name: 'geor',
    openTypeTags: ['geor'],
    isTopToBottom: false,
    standardCharacters: '\u10d8 \u10d4 \u10d0 \u1cbf',
    ranges: [0x10d0, 0x10ff, 0x1c90, 0x1cbf],
    nonbaseRanges: [],
  },
  {
    name: 'geok',
    openTypeTags: [],
    isTopToBottom: false,
    standardCharacters: '\u10b6 \u10b1 \u2d19',
    ranges: [0x10a0, 0x10cd, 0x2d00, 0x2d2d],
    nonbaseRanges: [],
  },
  {
    name: 'glag',
    openTypeTags: ['glag'],
    isTopToBottom: false,
    standardCharacters: '\u2c15 \u2c45',
    ranges: [0x2c00, 0x2c5f, 0x1e000, 0x1e02f],
    nonbaseRanges: [0x1e000, 0x1e02f],
  },
  {
    name: 'goth',
    openTypeTags: ['goth'],
    isTopToBottom: true,
    standardCharacters: '\u{10334} \u{1033e} \u{10343}',
    ranges: [0x10330, 0x1034f],
    nonbaseRanges: [],
  },
  {
    name: 'grek',
    openTypeTags: ['grek'],
    isTopToBottom: false,
    standardCharacters: '\u03bf \u039f',
    ranges: [0x370, 0x3ff, 0x1f00, 0x1fff],
    nonbaseRanges: [
      0x37a, 0x37a, 0x384, 0x385, 0x1fbd, 0x1fc1, 0x1fcd, 0x1fcf, 0x1fdd, 0x1fdf, 0x1fed, 0x1fef, 0x1ffd,
      0x1ffe,
    ],
  },
  {
    name: 'gujr',
    openTypeTags: ['gjr3', 'gjr2', 'gujr'],
    isTopToBottom: false,
    standardCharacters: '\u0a9f \u0ae6',
    ranges: [0xa80, 0xaff],
    nonbaseRanges: [0xa81, 0xa82, 0xabc, 0xabc, 0xac1, 0xac8, 0xacd, 0xacd, 0xae2, 0xae3, 0xafa, 0xaff],
  },
  {
    name: 'guru',
    openTypeTags: ['gur3', 'gur2', 'guru'],
    isTopToBottom: true,
    standardCharacters: '\u0a20 \u0a30 \u0a66',
    ranges: [0xa00, 0xa7f],
    nonbaseRanges: [0xa01, 0xa02, 0xa3c, 0xa3c, 0xa41, 0xa51, 0xa70, 0xa71, 0xa75, 0xa75],
  },
  {
    name: 'hebr',
    openTypeTags: ['hebr'],
    isTopToBottom: false,
    standardCharacters: '\u05dd',
    ranges: [0x590, 0x5ff, 0xfb1d, 0xfb4f],
    nonbaseRanges: [0x591, 0x5bf, 0x5c1, 0x5c2, 0x5c4, 0x5c5, 0x5c7, 0x5c7, 0xfb1e, 0xfb1e],
  },
  {
    name: 'kali',
    openTypeTags: ['kali'],
    isTopToBottom: false,
    standardCharacters: '\ua90d \ua900',
    ranges: [0xa900, 0xa92f],
    nonbaseRanges: [0xa926, 0xa92d],
  },
  {
    name: 'khmr',
    openTypeTags: ['khmr'],
    isTopToBottom: false,
    standardCharacters: '\u17e0',
    ranges: [0x1780, 0x17ff],
    nonbaseRanges: [0x17b7, 0x17bd, 0x17c6, 0x17c6, 0x17c9, 0x17d3, 0x17dd, 0x17dd],
  },
  {
    name: 'khms',
    openTypeTags: [],
    isTopToBottom: false,
    standardCharacters: '\u19e1 \u19ea',
    ranges: [0x19e0, 0x19ff],
    nonbaseRanges: [],
  },
  {
    name: 'knda',
    openTypeTags: ['knd3', 'knd2', 'knda'],
    isTopToBottom: false,
    standardCharacters: '\u0ce6 \u0cac',
    ranges: [0xc80, 0xcff],
    nonbaseRanges: [0xc81, 0xc81, 0xcbc, 0xcbc, 0xcbf, 0xcbf, 0xcc6, 0xcc6, 0xccc, 0xccd, 0xce2, 0xce3],
  },
  {
    name: 'lao',
    openTypeTags: ['lao '],
    isTopToBottom: false,
    standardCharacters: '\u0ed0',
    ranges: [0xe80, 0xeff],
    nonbaseRanges: [0xeb1, 0xeb1, 0xeb4, 0xebc, 0xec8, 0xece],
  },
  {
    name: 'latn',
    openTypeTags: ['latn'],
    isTopToBottom: false,
    standardCharacters: 'o O 0',
    ranges: [
      0x20, 0x7f, 0xa0, 0xa9, 0xab, 0xb1, 0xb4, 0xb8, 0xbb, 0xff, 0x100, 0x17f, 0x180, 0x24f, 0x250, 0x2af,
      0x2b9, 0x2df, 0x2e5, 0x2ff, 0x300, 0x36f, 0x1ab0, 0x1abe, 0x1d00, 0x1d2b, 0x1d6b, 0x1d77, 0x1d79,
      0x1d7f, 0x1d80, 0x1d9a, 0x1dc0, 0x1dff, 0x1e00, 0x1eff, 0x2000, 0x206f, 0x20a0, 0x20b8, 0x20ba, 0x20cf,
      0x2150, 0x218f, 0x2c60, 0x2c7b, 0x2c7e, 0x2c7f, 0x2e00, 0x2e7f, 0xa720, 0xa76f, 0xa771, 0xa7f0, 0xa7f2,
      0xa7f7, 0xa7fa, 0xa7ff, 0xab30, 0xab5b, 0xab60, 0xab68, 0xab6a, 0xab6f, 0xfb00, 0xfb06, 0x1d400,
      0x1d7ff, 0x1df00, 0x1dfff,
    ],
    nonbaseRanges: [
      0x5e, 0x60, 0x7e, 0x7e, 0xa8, 0xa9, 0xae, 0xb0, 0xb4, 0xb4, 0xb8, 0xb8, 0xbc, 0xbe, 0x2b9, 0x2df, 0x2e5,
      0x2ff, 0x300, 0x36f, 0x1ab0, 0x1aeb, 0x1dc0, 0x1dff, 0x2017, 0x2017, 0x203e, 0x203e, 0xa788, 0xa788,
      0xa7f8, 0xa7fa,
    ],
  },
  {
    name: 'latb',
    openTypeTags: [],
    isTopToBottom: false,
    standardCharacters: '\u2092 \u2080',
    ranges: [0x1d62, 0x1d6a, 0x2080, 0x209c, 0x2c7c, 0x2c7c],
    nonbaseRanges: [],
  },
  {
    name: 'latp',
    openTypeTags: [],
    isTopToBottom: false,
    standardCharacters: '\u1d52 \u1d3c \u2070',
    ranges: [
      0xaa, 0xaa, 0xb2, 0xb3, 0xb9, 0xba, 0x2b0, 0x2b8, 0x2e0, 0x2e4, 0x1d2c, 0x1d61, 0x1d78, 0x1d78, 0x1d9b,
      0x1dbf, 0x2070, 0x207f, 0x2c7d, 0x2c7d, 0xa770, 0xa770, 0xa7f1, 0xa7f1, 0xa7f8, 0xa7f9, 0xab5c, 0xab5f,
      0xab69, 0xab69, 0x10780, 0x107fb,
    ],
    nonbaseRanges: [],
  },
  {
    name: 'lisu',
    openTypeTags: ['lisu'],
    isTopToBottom: false,
    standardCharacters: '\ua4f3',
    ranges: [0xa4d0, 0xa4ff, 0x11fb0, 0x11fbf],
    nonbaseRanges: [],
  },
  {
    name: 'mlym',
    openTypeTags: ['mlm3', 'mlm2', 'mlym'],
    isTopToBottom: false,
    standardCharacters: '\u0d20 \u0d31',
    ranges: [0xd00, 0xd7f],
    nonbaseRanges: [0xd00, 0xd01, 0xd3b, 0xd3c, 0xd4d, 0xd4e, 0xd62, 0xd63],
  },
  {
    name: 'medf',
    openTypeTags: ['medf'],
    isTopToBottom: false,
    standardCharacters: '\u{16e61} \u{16e5b} \u{16e6f}',
    ranges: [0x16e40, 0x16e9f],
    nonbaseRanges: [],
  },
  {
    name: 'mong',
    openTypeTags: ['mong'],
    isTopToBottom: true,
    standardCharacters: '\u1842 \u182a',
    ranges: [0x1800, 0x18af, 0x11660, 0x1167f],
    nonbaseRanges: [0x1885, 0x1886, 0x18a9, 0x18a9],
  },
  {
    name: 'mymr',
    openTypeTags: ['mym2', 'mymr'],
    isTopToBottom: false,
    standardCharacters: '\u101d \u1004 \u1002',
    ranges: [0x1000, 0x109f, 0xa9e0, 0xa9ff, 0xaa60, 0xaa7f, 0x116d0, 0x116ff],
    nonbaseRanges: [
      0x102d, 0x1030, 0x1032, 0x1037, 0x103a, 0x103a, 0x103d, 0x103e, 0x1058, 0x1059, 0x105e, 0x1060, 0x1071,
      0x1074, 0x1082, 0x1082, 0x1085, 0x1086, 0x108d, 0x108d, 0xa9e5, 0xa9e5, 0xaa7c, 0xaa7c,
    ],
  },
  {
    name: 'nkoo',
    openTypeTags: ['nko '],
    isTopToBottom: false,
    standardCharacters: '\u07cb \u07c0',
    ranges: [0x7c0, 0x7ff],
    nonbaseRanges: [0x7eb, 0x7f5, 0x7fd, 0x7fd],
  },
  {
    name: 'none',
    openTypeTags: [],
    isTopToBottom: false,
    standardCharacters: '',
    ranges: [],
    nonbaseRanges: [],
  },
  {
    name: 'olck',
    openTypeTags: ['olck'],
    isTopToBottom: false,
    standardCharacters: '\u1c5b',
    ranges: [0x1c50, 0x1c7f],
    nonbaseRanges: [],
  },
  {
    name: 'orkh',
    openTypeTags: ['orkh'],
    isTopToBottom: false,
    standardCharacters: '\u{10c17}',
    ranges: [0x10c00, 0x10c4f],
    nonbaseRanges: [],
  },
  {
    name: 'osge',
    openTypeTags: ['osge'],
    isTopToBottom: false,
    standardCharacters: '\u{104c2} \u{104ea}',
    ranges: [0x104b0, 0x104ff],
    nonbaseRanges: [],
  },
  {
    name: 'osma',
    openTypeTags: ['osma'],
    isTopToBottom: false,
    standardCharacters: '\u{10486} \u{104a0}',
    ranges: [0x10480, 0x104af],
    nonbaseRanges: [],
  },
  {
    name: 'rohg',
    openTypeTags: ['rohg'],
    isTopToBottom: false,
    standardCharacters: '\u{10d30}',
    ranges: [0x10d00, 0x10d3f],
    nonbaseRanges: [],
  },
  {
    name: 'saur',
    openTypeTags: ['saur'],
    isTopToBottom: false,
    standardCharacters: '\ua89d \ua8d0',
    ranges: [0xa880, 0xa8df],
    nonbaseRanges: [0xa880, 0xa881, 0xa8b4, 0xa8c5],
  },
  {
    name: 'shaw',
    openTypeTags: ['shaw'],
    isTopToBottom: false,
    standardCharacters: '\u{10474}',
    ranges: [0x10450, 0x1047f],
    nonbaseRanges: [],
  },
  {
    name: 'sinh',
    openTypeTags: ['sinh'],
    isTopToBottom: false,
    standardCharacters: '\u0da7',
    ranges: [0xd80, 0xdff],
    nonbaseRanges: [0xd81, 0xd81, 0xdca, 0xdca, 0xdd2, 0xdd6],
  },
  {
    name: 'sund',
    openTypeTags: ['sund'],
    isTopToBottom: false,
    standardCharacters: '\u1bb0',
    ranges: [0x1b80, 0x1bbf, 0x1cc0, 0x1ccf],
    nonbaseRanges: [0x1b80, 0x1b82, 0x1ba1, 0x1bad],
  },
  {
    name: 'taml',
    openTypeTags: ['tml3', 'tml2', 'taml'],
    isTopToBottom: false,
    standardCharacters: '\u0be6',
    ranges: [0xb80, 0xbff, 0x11fc0, 0x11fff],
    nonbaseRanges: [0xb82, 0xb82, 0xbc0, 0xbc2, 0xbcd, 0xbcd],
  },
  {
    name: 'tavt',
    openTypeTags: ['tavt'],
    isTopToBottom: false,
    standardCharacters: '\uaa92 \uaaab',
    ranges: [0xaa80, 0xaadf],
    nonbaseRanges: [0xaab0, 0xaab0, 0xaab2, 0xaab4, 0xaab7, 0xaab8, 0xaabe, 0xaabf, 0xaac1, 0xaac1],
  },
  {
    name: 'telu',
    openTypeTags: ['tel3', 'tel2', 'telu'],
    isTopToBottom: false,
    standardCharacters: '\u0c66 \u0c67',
    ranges: [0xc00, 0xc7f],
    nonbaseRanges: [0xc00, 0xc00, 0xc04, 0xc04, 0xc3c, 0xc3c, 0xc3e, 0xc40, 0xc46, 0xc56, 0xc62, 0xc63],
  },
  {
    name: 'tfng',
    openTypeTags: ['tfng'],
    isTopToBottom: false,
    standardCharacters: '\u2d54',
    ranges: [0x2d30, 0x2d7f],
    nonbaseRanges: [],
  },
  {
    name: 'thai',
    openTypeTags: ['thai'],
    isTopToBottom: false,
    standardCharacters: '\u0e32 \u0e45 \u0e50',
    ranges: [0xe00, 0xe7f],
    nonbaseRanges: [0xe31, 0xe31, 0xe34, 0xe3a, 0xe47, 0xe4e],
  },
  {
    name: 'vaii',
    openTypeTags: ['vai '],
    isTopToBottom: false,
    standardCharacters: '\ua613 \ua59c \ua5b4',
    ranges: [0xa500, 0xa63f],
    nonbaseRanges: [],
  },
  {
    name: 'limb',
    openTypeTags: ['limb'],
    isTopToBottom: false,
    standardCharacters: 'o',
    ranges: [0x1900, 0x194f],
    nonbaseRanges: [0x1920, 0x1922, 0x1927, 0x1934, 0x1937, 0x193b],
  },
  {
    name: 'orya',
    openTypeTags: ['ory3', 'ory2', 'orya'],
    isTopToBottom: false,
    standardCharacters: 'o',
    ranges: [0xb00, 0xb7f],
    nonbaseRanges: [0xb01, 0xb02, 0xb3c, 0xb3c, 0xb3f, 0xb3f, 0xb41, 0xb44, 0xb4d, 0xb56, 0xb62, 0xb63],
  },
  {
    name: 'sylo',
    openTypeTags: ['sylo'],
    isTopToBottom: false,
    standardCharacters: 'o',
    ranges: [0xa800, 0xa82f],
    nonbaseRanges: [0xa802, 0xa802, 0xa806, 0xa806, 0xa80b, 0xa80b, 0xa825, 0xa826, 0xa82c, 0xa82c],
  },
  {
    name: 'tibt',
    openTypeTags: ['tibt'],
    isTopToBottom: false,
    standardCharacters: 'o',
    ranges: [0xf00, 0xfff],
    nonbaseRanges: [
      0xf18, 0xf19, 0xf35, 0xf35, 0xf37, 0xf37, 0xf39, 0xf39, 0xf3e, 0xf3f, 0xf71, 0xf7e, 0xf80, 0xf84, 0xf86,
      0xf87, 0xf8d, 0xfbc,
    ],
  },
  {
    name: 'hani',
    openTypeTags: ['hani'],
    isTopToBottom: false,
    standardCharacters: '\u7530 \u56d7',
    ranges: [
      0x1100, 0x11ff, 0x2e80, 0x2eff, 0x2f00, 0x2fdf, 0x2ff0, 0x2fff, 0x3000, 0x303f, 0x3040, 0x309f, 0x30a0,
      0x30ff, 0x3100, 0x312f, 0x3130, 0x318f, 0x3190, 0x319f, 0x31a0, 0x31bf, 0x31c0, 0x31ef, 0x31f0, 0x31ff,
      0x3300, 0x33ff, 0x3400, 0x4dbf, 0x4dc0, 0x4dff, 0x4e00, 0x9fff, 0xa960, 0xa97f, 0xac00, 0xd7af, 0xd7b0,
      0xd7ff, 0xf900, 0xfaff, 0xfe10, 0xfe1f, 0xfe30, 0xfe4f, 0xff00, 0xffef, 0x1aff0, 0x1afff, 0x1b000,
      0x1b0ff, 0x1b100, 0x1b12f, 0x1b130, 0x1b16f, 0x1d300, 0x1d35f, 0x20000, 0x2a6df, 0x2a700, 0x2b73f,
      0x2b740, 0x2b81f, 0x2b820, 0x2ceaf, 0x2ceb0, 0x2ebef, 0x2ebf0, 0x2ee5d, 0x2f800, 0x2fa1f, 0x30000,
      0x3134a, 0x31350, 0x323af, 0x323b0, 0x33479,
    ],
    nonbaseRanges: [0x302a, 0x302f, 0x3190, 0x319f],
  },
];

/** Pairs of first and last code point, as `AutofitScript` holds its ranges. */
export function* rangePairs(ranges: readonly number[]): Generator<[number, number]> {
  for (let i = 0; i < ranges.length; i += 2) yield [ranges[i]!, ranges[i + 1]!];
}

const COMMON_CHARACTER = /[\p{Script=Common}\p{Script=Inherited}]/u;

const isCommonCharacter = (character: string): boolean => COMMON_CHARACTER.test(character);

/**
 * The OpenType script tags of the first script whose ranges hold `codePoint`. A common character
 * has none: HarfBuzz gives a run of one such character the default script.
 */
export function scriptTagsOf(codePoint: number): readonly string[] {
  if (isCommonCharacter(String.fromCodePoint(codePoint))) return [];
  const script = AUTOFIT_SCRIPTS.find(({ ranges }) => {
    for (const [first, last] of rangePairs(ranges)) if (codePoint >= first && codePoint <= last) return true;
    return false;
  });
  return script?.openTypeTags ?? [];
}
