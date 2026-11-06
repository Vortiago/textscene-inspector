/**
 * The `GSUB` lookups of a shaping buffer, as HarfBuzz applies them: single, multiple, alternate and
 * ligature substitution, and the context and chaining context lookups that call others. A buffer
 * with glyph props skips the glyphs each lookup's flag ignores, as HarfBuzz's `skippy_iter` does.
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
import type { LookupGlyph } from './openTypeGdef';

/** One stage of lookups, applied in index order, and those of them that `rand` holds. */
export interface GsubStage {
  lookups: readonly number[];
  randomLookups: ReadonlySet<number>;
}

/**
 * The shaping buffer: its glyphs, the state of `rand`'s random number generator, the cluster of each
 * glyph, and the code point each glyph shapes (`hb_buffer_t`), the last two where the caller asks for
 * them. A cluster is the index of the first character the glyph draws. A glyph a lookup puts out
 * keeps the code point of the glyph it replaces, as HarfBuzz's `hb_glyph_info_t` does.
 */
export interface GsubBuffer {
  glyphs: number[];
  randomState: number;
  clusters?: number[];
  codePoints?: number[];
}

/** How a lookup's flag skips the glyphs of a buffer with code points: `glyphPropsReader` and `lookupMatcher`. */
export interface GlyphFilter {
  propsOf(glyph: LookupGlyph): number;
  matches(glyph: number, glyphProps: number, lookupProps: number): boolean;
}

/** The lookup being applied: its flag, and how the buffer's glyphs match it. A null filter skips none. */
interface LookupContext {
  readonly table: LayoutTable;
  readonly buffer: GsubBuffer;
  readonly filter: GlyphFilter | null;
  readonly lookupProps: number;
}

/** Whether the lookup reads the glyph at `at`, or skips it by its flag (`check_glyph_property`). */
function isRead({ buffer, filter, lookupProps }: LookupContext, at: number): boolean {
  if (!filter || !buffer.codePoints) return true;
  const glyph = buffer.glyphs[at]!;
  return filter.matches(glyph, filter.propsOf({ glyph, codePoint: buffer.codePoints[at]! }), lookupProps);
}

/** The next glyph past `from` in `step`'s direction that the lookup reads, or -1 past the buffer's end. */
function nextRead(context: LookupContext, from: number, step: 1 | -1): number {
  for (let at = from + step; at >= 0 && at < context.buffer.glyphs.length; at += step)
    if (isRead(context, at)) return at;
  return -1;
}

/**
 * `count` positions the lookup reads from `at` onward, `at` first, or null where the buffer ends
 * first: the glyphs a ligature or a context input matches past the glyphs the flag skips.
 */
function readPositions(context: LookupContext, at: number, count: number): number[] | null {
  const positions = [at];
  while (positions.length < count) {
    const next = nextRead(context, positions.at(-1)!, 1);
    if (next < 0) return null;
    positions.push(next);
  }
  return positions;
}

/**
 * Replaces the glyphs at `positions` with `replacement` at the first of them, as HarfBuzz's buffer
 * output does. A skipped glyph between them stays, after the replacement. Every glyph from the first
 * position to the last takes the lowest cluster among them (`hb_buffer_t::merge_clusters`).
 */
function replaceGlyphs(
  { buffer }: LookupContext,
  positions: readonly number[],
  replacement: readonly number[]
): void {
  const at = positions[0]!;
  const { clusters, codePoints } = buffer;
  if (clusters)
    clusters.fill(Math.min(...clusters.slice(at, positions.at(-1)! + 1)), at, positions.at(-1)! + 1);
  for (let k = positions.length - 1; k >= 1; k--) {
    buffer.glyphs.splice(positions[k]!, 1);
    clusters?.splice(positions[k]!, 1);
    codePoints?.splice(positions[k]!, 1);
  }
  buffer.glyphs.splice(at, 1, ...replacement);
  if (clusters) clusters.splice(at, 1, ...replacement.map(() => clusters[at]!));
  if (codePoints) codePoints.splice(at, 1, ...replacement.map(() => codePoints[at]!));
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

function applySingle(context: LookupContext, offset: number, at: number): Applied | null {
  const { dv } = context.table;
  const glyph = context.buffer.glyphs[at]!;
  const index = coverageIndex(dv, offset + u16(dv, offset + 2), glyph);
  if (index < 0) return null;
  replaceGlyphs(context, [at], [singleSubstitute(dv, offset, glyph, index)]);
  return { next: at + 1 };
}

function applyMultiple(context: LookupContext, offset: number, at: number): Applied | null {
  const { dv } = context.table;
  const index = coverageIndex(dv, offset + u16(dv, offset + 2), context.buffer.glyphs[at]!);
  if (index < 0) return null;
  const sequence = substituteList(dv, offset, index);
  replaceGlyphs(context, [at], sequence);
  return { next: at + sequence.length };
}

function applyAlternate(
  context: LookupContext,
  offset: number,
  at: number,
  isRandom: boolean
): Applied | null {
  const { dv } = context.table;
  const index = coverageIndex(dv, offset + u16(dv, offset + 2), context.buffer.glyphs[at]!);
  if (index < 0) return null;
  const alternates = substituteList(dv, offset, index);
  if (alternates.length === 0) return null;
  replaceGlyphs(context, [at], [alternateOf(alternates, context.buffer, isRandom)]);
  return { next: at + 1 };
}

function applyLigature(context: LookupContext, offset: number, at: number): Applied | null {
  const { dv } = context.table;
  const { glyphs } = context.buffer;
  const index = coverageIndex(dv, offset + u16(dv, offset + 2), glyphs[at]!);
  if (index < 0) return null;
  const set = offset + u16(dv, offset + 6 + 2 * index);
  for (let i = 0; i < u16(dv, set); i++) {
    const ligature = set + u16(dv, set + 2 + 2 * i);
    const componentCount = u16(dv, ligature + 2);
    // A ligature of no components would insert its glyph and never consume one (`Ligature::apply`).
    if (componentCount === 0) continue;
    const positions = readPositions(context, at, componentCount);
    if (!positions) continue;
    const isMatch = positions.every(
      (position, c) => c === 0 || glyphs[position] === u16(dv, ligature + 4 + 2 * (c - 1))
    );
    if (!isMatch) continue;
    replaceGlyphs(context, positions, [u16(dv, ligature)]);
    return { next: at + 1 };
  }
  return null;
}

/** How the values of a context rule match a glyph: as a glyph, a class, or a coverage offset. */
type Matcher = (glyph: number, value: number) => boolean;

/**
 * The positions of the rule's input where its backtrack, input after the first glyph, and lookahead
 * match around `at`, past the glyphs the lookup skips (`match_input`, `match_backtrack`,
 * `match_lookahead`). Null where the rule does not match.
 */
function matchedInput(
  context: LookupContext,
  at: number,
  rule: ContextRule,
  matchers: readonly [Matcher, Matcher, Matcher]
): number[] | null {
  const { glyphs } = context.buffer;
  const [matchBacktrack, matchInput, matchLookahead] = matchers;
  const input = readPositions(context, at, 1 + rule.input.length);
  if (!input || !rule.input.every((value, i) => matchInput(glyphs[input[i + 1]!]!, value))) return null;
  let back = at;
  for (const value of rule.backtrack) {
    back = nextRead(context, back, -1);
    if (back < 0 || !matchBacktrack(glyphs[back]!, value)) return null;
  }
  let ahead = input.at(-1)!;
  for (const value of rule.lookahead) {
    ahead = nextRead(context, ahead, 1);
    if (ahead < 0 || !matchLookahead(glyphs[ahead]!, value)) return null;
  }
  return input;
}

/** A rule of a context subtable that matches, with the positions of its input. */
interface MatchedRule {
  readonly rule: ContextRule;
  readonly input: number[];
}

/** The rule of a context subtable that matches at `at`, with how its values match. */
function matchingRule(
  context: LookupContext,
  offset: number,
  at: number,
  reader: ContextReader
): MatchedRule | null {
  const { dv } = context.table;
  const { glyphs } = context.buffer;
  const format = u16(dv, offset);
  const byGlyph: Matcher = (glyph, value) => glyph === value;
  const byCoverage: Matcher = (glyph, value) => coverageIndex(dv, offset + value, glyph) >= 0;
  const matched = (rule: ContextRule, matchers: readonly [Matcher, Matcher, Matcher]): MatchedRule | null => {
    const input = matchedInput(context, at, rule, matchers);
    return input && { rule, input };
  };
  if (format === 3) {
    const rule = reader.readFormat3(dv, offset);
    if (coverageIndex(dv, offset + rule.first, glyphs[at]!) < 0) return null;
    return matched(rule, [byCoverage, byCoverage, byCoverage]);
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
    const found = matched(reader.readRule(dv, set + u16(dv, set + 2 + 2 * i)), matchers);
    if (found) return found;
  }
  return null;
}

/** The deepest nesting of context lookups HarfBuzz follows (`HB_MAX_NESTING_LEVEL`). */
const MAX_NESTING = 64;

function applyContext(context: LookupContext, subtable: Subtable, at: number, depth: number): Applied | null {
  const isChain = subtable.type === GsubType.CHAIN_CONTEXT;
  const matched = matchingRule(context, subtable.offset, at, contextReaderOf(isChain));
  if (!matched) return null;
  const { rule, input } = matched;
  const { buffer } = context;
  for (const { sequenceIndex, lookupIndex } of rule.records) {
    if (depth >= MAX_NESTING || sequenceIndex >= input.length) continue;
    const lengthBefore = buffer.glyphs.length;
    const position = input[sequenceIndex]!;
    applyLookupAt(context.table, lookupIndex, buffer, context.filter, position, false, depth + 1);
    // The later input positions shift by the glyphs the nested lookup adds or removes (`apply_lookup`).
    const delta = buffer.glyphs.length - lengthBefore;
    for (let k = sequenceIndex + 1; k < input.length; k++) input[k] = Math.max(position, input[k]! + delta);
  }
  return { next: input.at(-1)! + 1 };
}

function applySubtable(
  context: LookupContext,
  subtable: Subtable,
  at: number,
  isRandom: boolean,
  depth: number
): Applied | null {
  switch (subtable.type) {
    case GsubType.SINGLE:
      return applySingle(context, subtable.offset, at);
    case GsubType.MULTIPLE:
      return applyMultiple(context, subtable.offset, at);
    case GsubType.ALTERNATE:
      return applyAlternate(context, subtable.offset, at, isRandom);
    case GsubType.LIGATURE:
      return applyLigature(context, subtable.offset, at);
    case GsubType.CONTEXT:
    case GsubType.CHAIN_CONTEXT:
      return applyContext(context, subtable, at, depth);
    default:
      return null;
  }
}

/**
 * Applies the first subtable of a lookup that applies at `at`, as a nested lookup does. A glyph that
 * the lookup's flag skips takes no subtable.
 */
function applyLookupAt(
  table: LayoutTable,
  lookupIndex: number,
  buffer: GsubBuffer,
  filter: GlyphFilter | null,
  at: number,
  isRandom: boolean,
  depth: number
): Applied | null {
  const lookup = table.lookups[lookupIndex];
  if (!lookup) return null;
  const context: LookupContext = { table, buffer, filter, lookupProps: lookup.props };
  if (!isRead(context, at)) return null;
  for (const subtable of lookup.subtables) {
    const applied = applySubtable(context, subtable, at, isRandom, depth);
    if (applied) return applied;
  }
  return null;
}

/** Applies `stages` to `buffer`. With `filter` and the buffer's props, each lookup skips the glyphs its flag ignores. */
export function applyGsub(
  table: LayoutTable,
  stages: readonly GsubStage[],
  buffer: GsubBuffer,
  filter: GlyphFilter | null = null
): void {
  for (const { lookups, randomLookups } of stages) {
    for (const lookupIndex of lookups) {
      const isRandom = randomLookups.has(lookupIndex);
      for (let at = 0; at < buffer.glyphs.length;) {
        const applied = applyLookupAt(table, lookupIndex, buffer, filter, at, isRandom, 0);
        // A deletion leaves `next` at `at`, on the glyph after the deleted one, which the lookup
        // still visits. A subtable that does not advance shrinks the buffer, so the loop ends.
        at = applied ? Math.max(applied.next, at) : at + 1;
      }
    }
  }
}
