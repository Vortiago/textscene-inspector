/**
 * FreeType's list of tricky fonts (`ttobjs.c`, `tt_check_trickyness`): old CJK fonts that build
 * their glyphs from components in their bytecode, so FreeType never auto-hints them and runs their
 * programs with backward compatibility off. A font is tricky by its family name, or by the
 * checksums and lengths of its `cvt `, `fpgm` and `prep` tables.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { perObject } from '../../../../utils/perObject';
import { familyNameOf } from './sfntFamilyName';
import { tableBytes, type SfntFile } from './sfntTables';

/** The family names FreeType finds anywhere in a family name, `?` standing for a non-ASCII character. */
const TRICKY_FAMILY_NAMES: readonly string[] = [
  'cpop',
  'DFGirl-W6-WIN-BF',
  'DFGothic-EB',
  'DFGyoSho-Lt',
  'DFHei',
  'DFHSGothic-W5',
  'DFHSMincho-W3',
  'DFHSMincho-W7',
  'DFKaiSho-SB',
  'DFKaiShu',
  'DFKai-SB',
  'DFMing',
  'DLC',
  'HuaTianKaiTi?',
  'HuaTianSongTi?',
  'Ming(for ISO10646)',
  'MingLiU',
  'MingMedium',
  'PMingLiU',
  'MingLi43',
];

/** The checksum and length of one table, a length of zero for a face without it. */
type TableId = readonly [checksum: number, length: number];
/** The `cvt `, `fpgm` and `prep` ids of one tricky face. */
type TrickyFace = readonly [cvt: TableId, fpgm: TableId, prep: TableId];

const NO_CVT: TableId = [0, 0];

const TRICKY_FACES: readonly TrickyFace[] = [
  [
    [0x05bcf058, 0x2e4],
    [0x28233bf1, 0x87c4],
    [0xa344a1ea, 0x1e1],
  ], // MingLiU 1995
  [
    [0x05bcf058, 0x2e4],
    [0x28233bf1, 0x87c4],
    [0xa344a1eb, 0x1e1],
  ], // MingLiU 1996-
  [
    [0x12c3ebb2, 0x350],
    [0xb680ee64, 0x87a7],
    [0xce939563, 0x758],
  ], // DFGothic-EB
  [
    [0x11e5ead4, 0x350],
    [0xce5956e9, 0xbc85],
    [0x8272f416, 0x45],
  ], // DFGyoSho-Lt
  [
    [0x1257eb46, 0x350],
    [0xf699d160, 0x715f],
    [0xd222f568, 0x3bc],
  ], // DFHei-Md-HK-BF
  [
    [0x1262eb4e, 0x350],
    [0xe86a5d64, 0x7940],
    [0x7850f729, 0x5ff],
  ], // DFHSGothic-W5
  [
    [0x122deb0a, 0x350],
    [0x3d16328a, 0x859b],
    [0xa93fc33b, 0x2cb],
  ], // DFHSMincho-W3
  [
    [0x125feb26, 0x350],
    [0xa5acc982, 0x7ee1],
    [0x90999196, 0x41f],
  ], // DFHSMincho-W7
  [
    [0x11e5ead4, 0x350],
    [0x5a30ca3b, 0x9063],
    [0x13a42602, 0x7e],
  ], // DFKaiShu
  [
    [0x11e5ead4, 0x350],
    [0xa6e78c01, 0x8998],
    [0x13a42602, 0x7e],
  ], // DFKaiShu, variant
  [
    [0x11e5ead4, 0x360],
    [0x9db282b2, 0xc06e],
    [0x53e6d7ca, 0x82],
  ], // DFKaiShu-Md-HK-BF
  [
    [0x1243eb18, 0x350],
    [0xba0a8c30, 0x74ad],
    [0xf3d83409, 0x37b],
  ], // DFMing-Bd-HK-BF
  [
    [0x07dcf546, 0x308],
    [0x40fe7c90, 0x8e2a],
    [0x608174b5, 0x7a],
  ], // DLCLiShu
  [
    [0xeb891238, 0x308],
    [0xd2e4dcd4, 0x676f],
    [0x8ea5f293, 0x3b8],
  ], // DLCHayBold
  [
    [0xfffbfffc, 0x8],
    [0x9c9e48b8, 0xbea2],
    [0x70020112, 0x8],
  ], // HuaTianKaiTi
  [
    [0xfffbfffc, 0x8],
    [0x0a5a0483, 0x17c39],
    [0x70020112, 0x8],
  ], // HuaTianSongTi
  [NO_CVT, [0x40c92555, 0xe5], [0xa39b58e3, 0x117c]], // NEC fadpop7.ttf
  [NO_CVT, [0x33c41652, 0xe5], [0x26d6c52a, 0xf6a]], // NEC fadrei5.ttf
  [NO_CVT, [0x6db1651d, 0x19d], [0x6c6e4b03, 0x2492]], // NEC fangot7.ttf
  [NO_CVT, [0x40c92555, 0xe5], [0xde51fad0, 0x117c]], // NEC fangyo5.ttf
  [NO_CVT, [0x85e47664, 0xe5], [0xa6c62831, 0x1caa]], // NEC fankyo5.ttf
  [NO_CVT, [0x2d891cfd, 0x19d], [0xa0604633, 0x1de8]], // NEC fanrgo5.ttf
  [NO_CVT, [0x40aa774c, 0x1cb], [0x9b5caa96, 0x1f9a]], // NEC fangot5.ttc
  [NO_CVT, [0x0d3de9cb, 0x141], [0xd4127766, 0x2280]], // NEC fanmin3.ttc
  [NO_CVT, [0x4a692698, 0x1f0], [0x340d4346, 0x1fca]], // NEC FA-Gothic, 1996
  [NO_CVT, [0xcd34c604, 0x166], [0x6cf31046, 0x22b0]], // NEC FA-Minchou, 1996
  [NO_CVT, [0x5da75315, 0x19d], [0x40745a5f, 0x22e0]], // NEC FA-RoundGothicB, 1996
  [NO_CVT, [0xf055fc48, 0x1c2], [0x3900ded3, 0x1e18]], // NEC FA-RoundGothicM, 1996
  [
    [0x00170003, 0x60],
    [0xdbb4306e, 0x58aa],
    [0xd643482a, 0x35],
  ], // MINGLI.TTF, 1992
  [
    [0x1269eb58, 0x350],
    [0x5cd5957a, 0x6a4e],
    [0xf758323a, 0x380],
  ], // DFHei-Bd-WIN-HK-BF
  [
    [0x122feb0b, 0x350],
    [0x7f10919a, 0x70a9],
    [0x7cd7e7b7, 0x25c],
  ], // DFMing-Md-WIN-HK-BF
];

/** The tables whose ids a tricky face lists, in the order of `TrickyFace`. */
const ID_TABLE_TAGS = ['cvt ', 'fpgm', 'prep'] as const;

/** A PDF subset prefix: six capital letters and `+`, which FreeType skips when one follows. */
const PDF_SUBSET_TAG = /^[A-Z]{6}\+(?=.)/;

function isTrickyFamily(familyName: string): boolean {
  const name = familyName.replace(PDF_SUBSET_TAG, '');
  return TRICKY_FAMILY_NAMES.some((trickyName) => name.includes(trickyName));
}

/** `tt_synth_sfnt_checksum`: the big-endian sum of the table's words, a short last word padded with zeros. */
function tableChecksum(bytes: Uint8Array): number {
  let checksum = 0;
  for (let at = 0; at < bytes.length; at += 4) {
    const word =
      (bytes[at]! << 24) | ((bytes[at + 1] ?? 0) << 16) | ((bytes[at + 2] ?? 0) << 8) | (bytes[at + 3] ?? 0);
    checksum = (checksum + word) >>> 0;
  }
  return checksum;
}

/**
 * `tt_check_trickyness_sfnt_ids`: whether the three tables of one listed face match, a missing one
 * by a zero length. Lengths compare first, so a font of no listed face sums no table.
 */
function hasTrickyTableIds(sfnt: SfntFile): boolean {
  const lengths = ID_TABLE_TAGS.map((tag) => sfnt.tables.get(tag)?.length ?? 0);
  const checksums: (number | undefined)[] = [];
  // A table past the file reads as no bytes, whose checksum is zero, as FreeType answers it.
  const checksumOf = (index: number) =>
    (checksums[index] ??= tableChecksum(tableBytes(sfnt, ID_TABLE_TAGS[index]!)));
  return TRICKY_FACES.some(
    (face) =>
      face.every(([, length], index) => lengths[index] === length) &&
      face.every(([checksum], index) => checksumOf(index) === checksum)
  );
}

function readTrickiness(sfnt: SfntFile): boolean {
  const familyName = familyNameOf(sfnt);
  return (familyName !== null && isTrickyFamily(familyName)) || hasTrickyTableIds(sfnt);
}

/**
 * Whether FreeType flags the font as tricky (`FT_FACE_FLAG_TRICKY`), read once per font for the
 * auto-hinter choice and the interpreter both.
 */
export const isTrickyFont = perObject(readTrickiness);
