/**
 * HarfBuzz's queries on single lookups that the auto-hinter makes to find the glyphs of a style
 * (`afshaper.c`): the glyphs a `GSUB` lookup puts out, the glyphs a `GPOS` lookup takes in
 * (`hb_ot_layout_lookup_collect_glyphs`), and whether a `GSUB` lookup substitutes one glyph on its
 * own (`hb_ot_layout_lookup_would_substitute`).
 *
 * Portions ported from HarfBuzz ("Old MIT" licence).
 * Copyright (C) 2007-2026 by Behdad Esfahbod and the HarfBuzz contributors.
 * See THIRD-PARTY-NOTICES.md.
 */

import { perObject } from '../../../../../utils/perObject';
import {
  classCoverage,
  type ContextRule,
  countedU16Values,
  type CoverageContextRule,
  coverageGlyphs,
  coverageIndex,
  glyphClass,
  glyphsByClass,
  type LayoutTable,
  readChainedSequenceContextFormat3,
  readChainedSequenceRule,
  readSequenceContextFormat3,
  readSequenceRule,
  singleSubstitute,
  type Subtable,
  u16,
  valueRecordSize,
} from './openTypeLayout';

const GsubType = {
  SINGLE: 1,
  MULTIPLE: 2,
  ALTERNATE: 3,
  LIGATURE: 4,
  CONTEXT: 5,
  CHAIN_CONTEXT: 6,
  REVERSE_CHAIN: 8,
} as const;
const GposType = {
  SINGLE: 1,
  PAIR: 2,
  CURSIVE: 3,
  MARK_TO_BASE: 4,
  MARK_TO_LIGATURE: 5,
  MARK_TO_MARK: 6,
  CONTEXT: 7,
  CHAIN_CONTEXT: 8,
} as const;

/** The subtables at the offsets after the count at `at`, relative to `base`; a zero offset is none. */
function offsetsAfterCount(dv: DataView, at: number, base: number): (number | null)[] {
  return countedU16Values(dv, at).map((offset) => (offset === 0 ? null : base + offset));
}

/** The rule sets of a context or chained context subtable of format 1 or 2, by coverage index or class. */
function ruleSets(dv: DataView, subtable: number, isChain: boolean): (ContextRule[] | null)[] {
  const format = u16(dv, subtable);
  const countAt = subtable + (format === 1 ? 4 : isChain ? 10 : 6);
  const readRule = isChain ? readChainedSequenceRule : readSequenceRule;
  return offsetsAfterCount(dv, countAt, subtable).map((set) =>
    set === null
      ? null
      : offsetsAfterCount(dv, set, set).flatMap((rule) => (rule === null ? [] : [readRule(dv, rule)]))
  );
}

/** The single rule of a context or chained context subtable of format 3, its values coverage offsets. */
function coverageRule(dv: DataView, subtable: number, isChain: boolean): CoverageContextRule {
  return isChain ? readChainedSequenceContextFormat3(dv, subtable) : readSequenceContextFormat3(dv, subtable);
}

/** The coverage table that gates a `GSUB` subtable (`get_coverage`). */
function gsubCoverage(dv: DataView, { type, offset }: Subtable): number {
  const isContext = type === GsubType.CONTEXT || type === GsubType.CHAIN_CONTEXT;
  if (isContext && u16(dv, offset) === 3)
    return offset + coverageRule(dv, offset, type === GsubType.CHAIN_CONTEXT).first;
  return offset + u16(dv, offset + 2);
}

/** The glyphs a `GSUB` subtable puts out itself, and the lookups it calls. */
function gsubOutput(dv: DataView, { type, offset }: Subtable): { glyphs: number[]; lookups: number[] } {
  const coverage = (): number[] => coverageGlyphs(dv, offset + u16(dv, offset + 2));
  const listsAfterCount = (at: number): number[] =>
    offsetsAfterCount(dv, at, offset).flatMap((list) => (list === null ? [] : countedU16Values(dv, list)));
  switch (type) {
    case GsubType.SINGLE: {
      // Format 2 puts out every substitute it lists, however many glyphs its coverage holds.
      if (u16(dv, offset) === 2) return { glyphs: countedU16Values(dv, offset + 4), lookups: [] };
      return {
        glyphs: coverage().map((glyph, index) => singleSubstitute(dv, offset, glyph, index)),
        lookups: [],
      };
    }
    case GsubType.MULTIPLE:
    case GsubType.ALTERNATE:
      return { glyphs: listsAfterCount(offset + 4), lookups: [] };
    case GsubType.LIGATURE: {
      const glyphs = offsetsAfterCount(dv, offset + 4, offset).flatMap((set) =>
        set === null
          ? []
          : offsetsAfterCount(dv, set, set).flatMap((ligature) =>
              ligature === null ? [] : [u16(dv, ligature)]
            )
      );
      return { glyphs, lookups: [] };
    }
    case GsubType.CONTEXT:
    case GsubType.CHAIN_CONTEXT:
      return {
        glyphs: [],
        lookups: contextRules(dv, offset, type === GsubType.CHAIN_CONTEXT).flatMap((rule) =>
          rule.records.map((record) => record.lookupIndex)
        ),
      };
    case GsubType.REVERSE_CHAIN: {
      const backtrackCount = u16(dv, offset + 4);
      const lookaheadAt = offset + 6 + 2 * backtrackCount;
      const substituteAt = lookaheadAt + 2 + 2 * u16(dv, lookaheadAt);
      return { glyphs: countedU16Values(dv, substituteAt), lookups: [] };
    }
    default:
      return { glyphs: [], lookups: [] };
  }
}

function contextRules(dv: DataView, subtable: number, isChain: boolean): ContextRule[] {
  if (u16(dv, subtable) === 3) return [coverageRule(dv, subtable, isChain)];
  return ruleSets(dv, subtable, isChain).flatMap((set) => set ?? []);
}

/**
 * `hb_ot_layout_lookup_collect_glyphs` into the output set of a `GSUB` lookup: the glyphs its
 * subtables put out, and those of each lookup a context calls, once each.
 */
export function collectGsubOutput(table: LayoutTable, lookupIndex: number, output: Set<number>): void {
  const visited = new Set<number>();
  const pending = [lookupIndex];
  while (pending.length > 0) {
    const lookup = table.lookups[pending.pop()!];
    for (const subtable of lookup?.subtables ?? []) {
      const { glyphs, lookups } = gsubOutput(table.dv, subtable);
      for (const glyph of glyphs) output.add(glyph);
      for (const nested of lookups) {
        if (visited.has(nested)) continue;
        visited.add(nested);
        pending.push(nested);
      }
    }
  }
}

/** The input glyphs of a context or chained context `GPOS` subtable: its coverage and each rule's input. */
function contextInput(dv: DataView, subtable: number, isChain: boolean): number[] {
  const format = u16(dv, subtable);
  if (format === 3) {
    const { first, input } = coverageRule(dv, subtable, isChain);
    return [first, ...input].flatMap((coverage) => coverageGlyphs(dv, subtable + coverage));
  }
  const glyphs = coverageGlyphs(dv, subtable + u16(dv, subtable + 2));
  const sets = ruleSets(dv, subtable, isChain);
  const classes = format === 2 ? glyphsByClass(dv, subtable + u16(dv, subtable + (isChain ? 6 : 4))) : null;
  const coveredSets = format === 1 ? sets.slice(0, glyphs.length) : sets;
  for (const rule of coveredSets.flatMap((set) => set ?? []))
    for (const value of rule.input) glyphs.push(...(classes ? (classes.get(value) ?? []) : [value]));
  return glyphs;
}

function gposInput(dv: DataView, { type, offset }: Subtable): number[] {
  const coverageAt = (field: number): number[] => coverageGlyphs(dv, offset + u16(dv, offset + field));
  switch (type) {
    case GposType.SINGLE:
    case GposType.CURSIVE:
      return coverageAt(2);
    case GposType.PAIR: {
      const glyphs = coverageAt(2);
      if (u16(dv, offset) === 2) return [...glyphs, ...classCoverage(dv, offset + u16(dv, offset + 10))];
      const recordSize = 2 + valueRecordSize(u16(dv, offset + 4)) + valueRecordSize(u16(dv, offset + 6));
      for (const set of offsetsAfterCount(dv, offset + 8, offset)) {
        if (set === null) continue;
        for (let i = 0; i < u16(dv, set); i++) glyphs.push(u16(dv, set + 2 + i * recordSize));
      }
      return glyphs;
    }
    case GposType.MARK_TO_BASE:
    case GposType.MARK_TO_LIGATURE:
    case GposType.MARK_TO_MARK:
      return [...coverageAt(2), ...coverageAt(4)];
    case GposType.CONTEXT:
    case GposType.CHAIN_CONTEXT:
      return contextInput(dv, offset, type === GposType.CHAIN_CONTEXT);
    default:
      return [];
  }
}

/** `hb_ot_layout_lookup_collect_glyphs` into the input set of a `GPOS` lookup. */
export function collectGposInput(table: LayoutTable, lookupIndex: number, input: Set<number>): void {
  for (const subtable of table.lookups[lookupIndex]?.subtables ?? [])
    for (const glyph of gposInput(table.dv, subtable)) input.add(glyph);
}

/**
 * `hb_set_digest_t`: three 64-bit masks of the glyph bits at shifts 4, 0 and 6. A lookup answers
 * only for a glyph its digest may have, so a glyph the masks share passes too.
 */
const DIGEST_SHIFTS = [4, 0, 6] as const;

/** The word of a digest's masks, two 32-bit words to a mask, that holds the bit of `glyph` at `shift`. */
const digestWord = (glyph: number, shift: number, mask: number): number =>
  2 * mask + (((glyph >>> shift) & 63) >>> 5);
const digestBit = (glyph: number, shift: number): number => 1 << ((glyph >>> shift) & 31);

function digestOf(glyphs: readonly number[]): Uint32Array {
  const words = new Uint32Array(2 * DIGEST_SHIFTS.length);
  for (const glyph of glyphs)
    DIGEST_SHIFTS.forEach(
      (shift, mask) => (words[digestWord(glyph, shift, mask)]! |= digestBit(glyph, shift))
    );
  return words;
}

const digestMayHave = (words: Uint32Array, glyph: number): boolean =>
  DIGEST_SHIFTS.every(
    (shift, mask) => (words[digestWord(glyph, shift, mask)]! & digestBit(glyph, shift)) !== 0
  );

/** Whether a context rule of one input and, with zero context, no backtrack or lookahead, applies alone. */
const isLoneRule = (rule: ContextRule): boolean =>
  rule.inputCount === 1 && rule.backtrack.length === 0 && rule.lookahead.length === 0;

function subtableWouldSubstitute(dv: DataView, subtable: Subtable, glyph: number): boolean {
  const { type, offset } = subtable;
  const coverage = offset + u16(dv, offset + 2);
  switch (type) {
    case GsubType.SINGLE:
    case GsubType.MULTIPLE:
    case GsubType.ALTERNATE:
    case GsubType.REVERSE_CHAIN:
      return coverageIndex(dv, coverage, glyph) >= 0;
    case GsubType.LIGATURE: {
      const set = offsetsAfterCount(dv, offset + 4, offset)[coverageIndex(dv, coverage, glyph)];
      return (
        set != null &&
        offsetsAfterCount(dv, set, set).some((ligature) => ligature !== null && u16(dv, ligature + 2) === 1)
      );
    }
    case GsubType.CONTEXT:
    case GsubType.CHAIN_CONTEXT: {
      const isChain = type === GsubType.CHAIN_CONTEXT;
      const format = u16(dv, offset);
      if (format === 3) return isLoneRule(coverageRule(dv, offset, isChain));
      const index =
        format === 1
          ? coverageIndex(dv, coverage, glyph)
          : glyphClass(dv, offset + u16(dv, offset + (isChain ? 6 : 4)), glyph);
      return ruleSets(dv, offset, isChain)[index]?.some(isLoneRule) ?? false;
    }
    default:
      return false;
  }
}

/** The set digest of each lookup of a table, built on the first would-substitute ask. */
const lookupDigests = perObject((table: LayoutTable) =>
  table.lookups.map((lookup) =>
    digestOf(
      lookup.subtables.flatMap((subtable) => coverageGlyphs(table.dv, gsubCoverage(table.dv, subtable)))
    )
  )
);

/** `hb_ot_layout_lookup_would_substitute` of one glyph with zero context. */
export function wouldSubstitute(table: LayoutTable, lookupIndex: number, glyph: number): boolean {
  const lookup = table.lookups[lookupIndex];
  if (!lookup) return false;
  if (!digestMayHave(lookupDigests(table)[lookupIndex]!, glyph)) return false;
  return lookup.subtables.some((subtable) => subtableWouldSubstitute(table.dv, subtable, glyph));
}
