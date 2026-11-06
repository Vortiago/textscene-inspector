/**
 * The `GSUB` lookups of a shaping buffer, as HarfBuzz applies them: single, multiple, alternate and
 * ligature substitution, and the context and chaining context lookups that call others.
 *
 * Portions ported from HarfBuzz ("Old MIT" licence).
 * Copyright (C) 2007-2026 by Behdad Esfahbod and the HarfBuzz contributors.
 * See THIRD-PARTY-NOTICES.md.
 */

import {
  type ContextReader,
  contextReaderOf,
  type ContextRule,
  coverageIndex,
  glyphClass,
  GsubType,
  type LayoutTable,
  singleSubstitute,
  substituteList,
  type Subtable,
  u16,
} from './openTypeLayout';

/** One stage of lookups, applied in index order, and those of them that `rand` holds. */
export interface GsubStage {
  lookups: readonly number[];
  randomLookups: ReadonlySet<number>;
}

/** The shaping buffer: its glyphs, and the state of `rand`'s random number generator (`hb_buffer_t`). */
export interface GsubBuffer {
  glyphs: number[];
  randomState: number;
}

/** HarfBuzz's random alternate: a Lehmer generator seeded with 1 (`hb_ot_apply_context_t::random_number`). */
function nextRandom(buffer: GsubBuffer): number {
  buffer.randomState = (buffer.randomState * 48271) % 2147483647;
  return buffer.randomState;
}

/** The substitute of an alternate set: the first, or a random one for `rand`. */
function alternateOf(alternates: readonly number[], buffer: GsubBuffer, isRandom: boolean): number {
  const index = isRandom ? nextRandom(buffer) % alternates.length : 0;
  return alternates[index]!;
}

interface Applied {
  /** The position after the glyphs the subtable consumed or put out. */
  next: number;
}

function applySingle(dv: DataView, offset: number, buffer: GsubBuffer, at: number): Applied | null {
  const glyph = buffer.glyphs[at]!;
  const index = coverageIndex(dv, offset + u16(dv, offset + 2), glyph);
  if (index < 0) return null;
  buffer.glyphs[at] = singleSubstitute(dv, offset, glyph, index);
  return { next: at + 1 };
}

function applyMultiple(dv: DataView, offset: number, buffer: GsubBuffer, at: number): Applied | null {
  const index = coverageIndex(dv, offset + u16(dv, offset + 2), buffer.glyphs[at]!);
  if (index < 0) return null;
  const sequence = substituteList(dv, offset, index);
  buffer.glyphs.splice(at, 1, ...sequence);
  return { next: at + sequence.length };
}

function applyAlternate(
  dv: DataView,
  offset: number,
  buffer: GsubBuffer,
  at: number,
  isRandom: boolean
): Applied | null {
  const index = coverageIndex(dv, offset + u16(dv, offset + 2), buffer.glyphs[at]!);
  if (index < 0) return null;
  const alternates = substituteList(dv, offset, index);
  if (alternates.length === 0) return null;
  buffer.glyphs[at] = alternateOf(alternates, buffer, isRandom);
  return { next: at + 1 };
}

function applyLigature(dv: DataView, offset: number, buffer: GsubBuffer, at: number): Applied | null {
  const index = coverageIndex(dv, offset + u16(dv, offset + 2), buffer.glyphs[at]!);
  if (index < 0) return null;
  const set = offset + u16(dv, offset + 6 + 2 * index);
  for (let i = 0; i < u16(dv, set); i++) {
    const ligature = set + u16(dv, set + 2 + 2 * i);
    const componentCount = u16(dv, ligature + 2);
    // A ligature of no components would insert its glyph and never consume one (`Ligature::apply`).
    if (componentCount === 0 || at + componentCount > buffer.glyphs.length) continue;
    let isMatch = true;
    for (let c = 1; c < componentCount && isMatch; c++)
      isMatch = buffer.glyphs[at + c] === u16(dv, ligature + 4 + 2 * (c - 1));
    if (!isMatch) continue;
    buffer.glyphs.splice(at, componentCount, u16(dv, ligature));
    return { next: at + 1 };
  }
  return null;
}

/** How the values of a context rule match a glyph: as a glyph, a class, or a coverage offset. */
type Matcher = (glyph: number, value: number) => boolean;

/** Whether the rule's backtrack, input after the first glyph, and lookahead match around `at`. */
function ruleMatches(
  glyphs: readonly number[],
  at: number,
  rule: ContextRule,
  matchers: readonly [Matcher, Matcher, Matcher]
): boolean {
  const [matchBacktrack, matchInput, matchLookahead] = matchers;
  if (at < rule.backtrack.length || at + 1 + rule.input.length + rule.lookahead.length > glyphs.length)
    return false;
  return (
    rule.backtrack.every((value, i) => matchBacktrack(glyphs[at - 1 - i]!, value)) &&
    rule.input.every((value, i) => matchInput(glyphs[at + 1 + i]!, value)) &&
    rule.lookahead.every((value, i) => matchLookahead(glyphs[at + 1 + rule.input.length + i]!, value))
  );
}

/** The rule of a context subtable that matches at `at`, with how its values match. */
function matchingRule(
  dv: DataView,
  offset: number,
  glyphs: readonly number[],
  at: number,
  reader: ContextReader
): ContextRule | null {
  const format = u16(dv, offset);
  const byGlyph: Matcher = (glyph, value) => glyph === value;
  const byCoverage: Matcher = (glyph, value) => coverageIndex(dv, offset + value, glyph) >= 0;
  if (format === 3) {
    const rule = reader.readFormat3(dv, offset);
    if (coverageIndex(dv, offset + rule.first, glyphs[at]!) < 0) return null;
    return ruleMatches(glyphs, at, rule, [byCoverage, byCoverage, byCoverage]) ? rule : null;
  }
  const coverage = coverageIndex(dv, offset + u16(dv, offset + 2), glyphs[at]!);
  if (coverage < 0) return null;
  const classDefs =
    format === 2 ? reader.classDefFields.map((field) => offset + u16(dv, offset + field)) : null;
  const byClass =
    (classDef: number): Matcher =>
    (glyph, value) =>
      glyphClass(dv, classDef, glyph) === value;
  const matchers: [Matcher, Matcher, Matcher] = classDefs
    ? [byClass(classDefs[0]!), byClass(classDefs[1]!), byClass(classDefs[2]!)]
    : [byGlyph, byGlyph, byGlyph];
  const setIndex = classDefs ? glyphClass(dv, classDefs[1]!, glyphs[at]!) : coverage;
  const countAt = offset + (format === 1 ? 4 : reader.classSetCountField);
  if (setIndex >= u16(dv, countAt)) return null;
  const setOffset = u16(dv, countAt + 2 + 2 * setIndex);
  if (setOffset === 0) return null;
  const set = offset + setOffset;
  for (let i = 0; i < u16(dv, set); i++) {
    const rule = reader.readRule(dv, set + u16(dv, set + 2 + 2 * i));
    if (ruleMatches(glyphs, at, rule, matchers)) return rule;
  }
  return null;
}

/** The deepest nesting of context lookups HarfBuzz follows (`HB_MAX_NESTING_LEVEL`). */
const MAX_NESTING = 64;

function applyContext(
  table: LayoutTable,
  subtable: Subtable,
  buffer: GsubBuffer,
  at: number,
  depth: number
): Applied | null {
  const rule = matchingRule(
    table.dv,
    subtable.offset,
    buffer.glyphs,
    at,
    contextReaderOf(subtable.type === GsubType.CHAIN_CONTEXT)
  );
  if (!rule) return null;
  let end = at + 1 + rule.input.length;
  for (const { sequenceIndex, lookupIndex } of rule.records) {
    if (depth >= MAX_NESTING || sequenceIndex >= end - at) continue;
    const lengthBefore = buffer.glyphs.length;
    applyLookupAt(table, lookupIndex, buffer, at + sequenceIndex, false, depth + 1);
    end += buffer.glyphs.length - lengthBefore;
  }
  return { next: end };
}

function applySubtable(
  table: LayoutTable,
  subtable: Subtable,
  buffer: GsubBuffer,
  at: number,
  isRandom: boolean,
  depth: number
): Applied | null {
  const { dv } = table;
  switch (subtable.type) {
    case GsubType.SINGLE:
      return applySingle(dv, subtable.offset, buffer, at);
    case GsubType.MULTIPLE:
      return applyMultiple(dv, subtable.offset, buffer, at);
    case GsubType.ALTERNATE:
      return applyAlternate(dv, subtable.offset, buffer, at, isRandom);
    case GsubType.LIGATURE:
      return applyLigature(dv, subtable.offset, buffer, at);
    case GsubType.CONTEXT:
    case GsubType.CHAIN_CONTEXT:
      return applyContext(table, subtable, buffer, at, depth);
    default:
      return null;
  }
}

/** Applies the first subtable of a lookup that applies at `at`, as a nested lookup does. */
function applyLookupAt(
  table: LayoutTable,
  lookupIndex: number,
  buffer: GsubBuffer,
  at: number,
  isRandom: boolean,
  depth: number
): Applied | null {
  for (const subtable of table.lookups[lookupIndex]?.subtables ?? []) {
    const applied = applySubtable(table, subtable, buffer, at, isRandom, depth);
    if (applied) return applied;
  }
  return null;
}

export function applyGsub(table: LayoutTable, stages: readonly GsubStage[], buffer: GsubBuffer): void {
  for (const { lookups, randomLookups } of stages) {
    for (const lookupIndex of lookups) {
      for (let at = 0; at < buffer.glyphs.length;) {
        const applied = applyLookupAt(table, lookupIndex, buffer, at, randomLookups.has(lookupIndex), 0);
        // A deletion leaves `next` at `at`, on the glyph after the deleted one, which the lookup
        // still visits. A subtable that does not advance shrinks the buffer, so the loop ends.
        at = applied ? Math.max(applied.next, at) : at + 1;
      }
    }
  }
}
