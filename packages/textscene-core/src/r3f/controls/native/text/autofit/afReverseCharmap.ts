/**
 * The reverse character map of a style (`af_reverse_character_map_new`, `afadjust.c`): the code
 * point of each glyph the adjustment database names, through `cmap` and through the single and
 * alternate substitutions of the style's script (`afgsub.c`). It tells the hinter which glyphs
 * carry a diacritic to move clear of the base glyph.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 2025-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { ADJUSTMENT_DATABASE } from './afAdjustmentDatabase';
import type { StyleMetrics } from './afFace';
import { AUTOFIT_SCRIPTS } from './afScripts';
import { FtNumberHash } from './ftHash';
import {
  collectLookups,
  coverageGlyphs,
  type LayoutTable,
  singleSubstitute,
  substituteList,
  type Subtable,
  u16,
} from './openTypeLayout';

/** The code point of each glyph the adjustment database reaches. */
export type ReverseCharmap = ReadonlyMap<number, number>;

/** `af_adjustment_database_lookup`: FreeType's binary search, over its table as it is ordered. */
export function adjustmentFlagsOf(codePoint: number): number {
  let low = 0;
  let high = ADJUSTMENT_DATABASE.length / 2 - 1;
  while (high >= low) {
    const mid = (low + high) >> 1;
    const midCodePoint = ADJUSTMENT_DATABASE[2 * mid]!;
    if (midCodePoint < codePoint) low = mid + 1;
    else if (midCodePoint > codePoint) high = mid - 1;
    else return ADJUSTMENT_DATABASE[2 * mid + 1]!;
  }
  return 0;
}

/**
 * `af_validate_lookup_table`: whether every subtable of the lookup is a single or alternate
 * substitution, of one type through its extensions, that fits the table.
 */
function isSingleOrAlternateLookup(dv: DataView, subtables: readonly Subtable[], tableEnd: number): boolean {
  const types = new Set(subtables.map((subtable) => subtable.type));
  if (types.size > 1) return false;
  return subtables.every(({ type, offset }) => {
    if (offset + 6 > tableEnd) return false;
    const format = u16(dv, offset);
    const coverage = offset + u16(dv, offset + 2);
    const covered = coverageCount(dv, coverage, tableEnd);
    if (covered === null) return false;
    if (type === 1 && format === 1) return true;
    if (type === 1 && format === 2)
      return offset + 6 + 2 * u16(dv, offset + 4) <= tableEnd && u16(dv, offset + 4) === covered;
    if (type === 3 && format === 1) return alternateSetsFit(dv, offset, covered, tableEnd);
    return false;
  });
}

/** `af_validate_coverage`: the glyph count of the coverage table at `at`, or null when it is broken. */
function coverageCount(dv: DataView, at: number, tableEnd: number): number | null {
  if (at + 4 > tableEnd) return null;
  const format = u16(dv, at);
  const count = u16(dv, at + 2);
  if (format === 1) return at + 4 + 2 * count <= tableEnd ? count : null;
  if (format !== 2 || at + 4 + 6 * count > tableEnd) return null;
  let total = 0;
  for (let i = 0; i < count; i++) {
    const start = u16(dv, at + 4 + 6 * i);
    const end = u16(dv, at + 6 + 6 * i);
    if (start > end) return null;
    total += end - start + 1;
  }
  return total;
}

function alternateSetsFit(dv: DataView, offset: number, covered: number, tableEnd: number): boolean {
  const setCount = u16(dv, offset + 4);
  if (offset + 6 + 2 * setCount > tableEnd || setCount !== covered) return false;
  for (let i = 0; i < setCount; i++) {
    const set = offset + u16(dv, offset + 6 + 2 * i);
    if (set + 2 > tableEnd || set + 2 + 2 * u16(dv, set) > tableEnd) return false;
  }
  return true;
}

/**
 * `af_hash_insert`: maps `glyph` to `substitute`. A glyph's later substitutes go under `glyph`
 * plus 0x10000 times their number, and its first entry counts them in its upper half.
 */
function insertSubstitute(map: FtNumberHash, glyph: number, substitute: number): void {
  const node = map.node(glyph);
  if (!node) {
    map.insert(glyph, substitute);
    return;
  }
  const mask = (node.data & 0xffff0000) + 0x10000;
  map.insert(glyph + mask, substitute);
  node.data += 0x10000;
}

/** `af_map_lookup`: the substitutions of a single or alternate substitution lookup. */
function mapLookup(dv: DataView, subtables: readonly Subtable[], map: FtNumberHash): void {
  for (const { type, offset } of subtables) {
    const glyphs = coverageGlyphs(dv, offset + u16(dv, offset + 2));
    glyphs.forEach((glyph, index) => {
      if (type === 1) insertSubstitute(map, glyph, singleSubstitute(dv, offset, glyph, index));
      else for (const alternate of substituteList(dv, offset, index)) insertSubstitute(map, glyph, alternate);
    });
  }
}

/** The substitutions of the style's script, by glyph, in FreeType's hash order. */
function substitutionMap(gsub: LayoutTable, metrics: StyleMetrics): FtNumberHash {
  const map = new FtNumberHash();
  const scriptTags = AUTOFIT_SCRIPTS[metrics.style.script]!.openTypeTags.slice(0, 1);
  for (const lookupIndex of collectLookups(gsub, scriptTags, null)) {
    const { subtables } = gsub.lookups[lookupIndex]!;
    if (isSingleOrAlternateLookup(gsub.dv, subtables, gsub.end)) mapLookup(gsub.dv, subtables, map);
  }
  return map;
}

/** `add_substitute`: gives each substitute of `glyph` its code point, and theirs in turn. */
function addSubstitutes(
  glyph: number,
  value: number,
  codePoint: number,
  reverse: Map<number, number>,
  substitutions: FtNumberHash
): void {
  const addOne = (substitute: number): void => {
    if (reverse.has(substitute)) return;
    reverse.set(substitute, codePoint);
    const next = substitutions.node(substitute);
    if (next) addSubstitutes(substitute, next.data, codePoint, reverse, substitutions);
  };
  addOne(value & 0xffff);
  const laterCount = Math.floor(value / 0x10000);
  for (let i = 1; i <= laterCount; i++) addOne(substitutions.node(glyph + i * 0x10000)!.data);
}

/** `af_reverse_character_map_new` for the style of `metrics`. */
export function reverseCharmapOf(metrics: StyleMetrics): ReverseCharmap {
  const { face } = metrics.globals;
  const reverse = new Map<number, number>();
  for (let i = 0; i < ADJUSTMENT_DATABASE.length; i += 2) {
    const codePoint = ADJUSTMENT_DATABASE[i]!;
    const glyph = face.glyphIndex(codePoint);
    if (glyph !== 0) reverse.set(glyph, codePoint);
  }
  if (!face.gsub) return reverse;
  const substitutions = substitutionMap(face.gsub, metrics);
  for (const { key, data } of substitutions.entries()) {
    if (key >= 0x10000) continue;
    const codePoint = reverse.get(key);
    if (codePoint !== undefined) addSubstitutes(key, data, codePoint, reverse, substitutions);
  }
  return reverse;
}
