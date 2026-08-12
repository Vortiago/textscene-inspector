/**
 * A comment that quotes an engine hint range must describe the bound beside it.
 *
 * The gap this closes sits between two guards that both pass on it.
 * `boundGrounding` asks whether a bound carries a citation; the citation sweep
 * asks whether that citation points at the right engine line. Neither asks
 * whether the CODE implements what the comment says the engine declared, so
 * `Polygon2D.internal_vertex_count` shipped with a comment reading
 * `polygon_2d.cpp:722 hints "0,1000" hard both ends` and a validator carrying
 * only the floor. Correct cite, correct quoted numbers, missing ceiling, and
 * the slice's own test agreed with the code because it was written from it.
 *
 * Read from SOURCE TEXT rather than the registry, deliberately: the claim under
 * test is one a comment makes, and a comment does not survive into the built
 * validator. That makes this the one guard here that a `.ts` file can silence
 * by deleting its own comment — which is why the sweep also asserts a floor on
 * how many quoted hints it finds, so quietly dropping them all is not a way out.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { walk } from './testing/ruleNameScrape.js';

const RESOURCES = join(import.meta.dirname, '../resources');
const DECLARES_BOUNDS = (name: string) =>
  name === 'linterParser.ts' || name === 'linterValidators.ts';

/** A `"lo,hi…"` range inside a comment — Godot's `PROPERTY_HINT_RANGE` string. */
const QUOTED_HINT = /"(-?[\d.]+)\s*,\s*(-?[\d.]+)([^"]*)"/;

/**
 * Ends where the code deliberately departs from its hint, each because the
 * SETTER disagrees with the hint and the setter is what the engine enforces.
 *
 * An entry names the engine guard that justifies it, so a reader can check the
 * claim; an entry that stops corresponding to a real divergence fails below
 * rather than sitting here forever.
 */
/**
 * Empty, and it should stay that way: every divergence found so far is on a Node
 * class, which the engine-data guard owns. An entry here would mean a Resource
 * whose setter disagrees with its own hint.
 */
const SETTER_OVERRIDES_HINT: ReadonlyMap<string, string> = new Map();

interface Quoted {
  label: string;
  file: string;
  line: number;
  lo: number;
  hi: number;
  openMin: boolean;
  openMax: boolean;
  codeMin: number | null;
  codeMax: number | null;
}

/** Every property whose preceding comment quotes a hint range, with the bound it declares. */
function quotedHints(): Quoted[] {
  const found: Quoted[] = [];
  for (const file of walk(RESOURCES, DECLARES_BOUNDS)) {
    const source = readFileSync(file, 'utf8');
    const lines = source.split('\n');
    const type = source.match(/registerAll\(\s*'([^']+)'/)?.[1] ?? '?';
    for (let i = 0; i < lines.length; i++) {
      const key = lines[i]!.match(
        /^\s{2,}\[?[`']?([a-z_0-9/#*${}]+)[`']?\]?\s*:\s*(?:v\.|layerBitmask|maskedBitField|accepts|indexedFamily)/
      )?.[1];
      if (!key) continue;

      // The comment block directly above the key: the claim under test.
      let c = i - 1;
      let comment = '';
      while (c >= 0 && /^\s*(\/\/|\*|\/\*)/.test(lines[c]!)) { comment = `${lines[c]!}\n${comment}`; c--; }

      // The property's OWN expression, by paren balance: a fixed line window
      // reads a neighbour's bound and reports a disagreement that is not there.
      let depth = 0;
      let started = false;
      let expr = '';
      let end = i;
      for (; end < lines.length && end < i + 30; end++) {
        for (const ch of lines[end]!) {
          if (ch === '(') { depth++; started = true; }
          if (ch === ')') depth--;
        }
        expr += `${lines[end]!}\n`;
        if (started && depth <= 0) break;
      }
      // Resume past the expression, so a line inside it cannot match as a key.
      i = end;

      // `PROPERTY_HINT_ENUM` takes a comma-separated LABEL list, which reads
      // exactly like a range when the labels are numeric: VoxelGI's
      // "64,128,256,512" names four constants serialised as 0-3.
      if (/PROPERTY_HINT_ENUM/.test(comment)) continue;
      const hint = QUOTED_HINT.exec(comment);
      if (!hint) continue;

      // A radians-as-degrees property states DEGREES in the hint and stores
      // radians, so the two are not comparable without converting.
      if (/maxDeg|minDeg|radian/i.test(expr)) continue;

      const enumArity = expr.match(/enumInt\([^,]+,\s*(-?\d+)\s*,\s*(-?\d+)/);
      const min = expr.match(/\bmin:\s*(-?[\d.]+)/);
      const max = expr.match(/\bmax:\s*(-?[\d.]+)/);
      const codeMin = enumArity ? Number(enumArity[1]) : min ? Number(min[1]) : null;
      const codeMax = enumArity ? Number(enumArity[2]) : max ? Number(max[1]) : null;
      if (codeMin === null && codeMax === null) continue;

      found.push({
        label: `${type}.${key}`,
        file: relative(join(import.meta.dirname, '../..'), file),
        line: i + 1,
        lo: Number(hint[1]),
        hi: Number(hint[2]),
        openMin: /or_less/.test(hint[3]!),
        openMax: /or_greater/.test(hint[3]!),
        codeMin,
        codeMax,
      });
    }
  }
  return found;
}

/** How `q`'s implemented bound departs from the hint its comment quotes. */
function departures(q: Quoted): string[] {
  const out: string[] = [];
  if (!q.openMin) {
    if (q.codeMin === null) out.push(`hint floors at ${q.lo}, code declares no min`);
    // `Number.MIN_VALUE` is "the smallest value above zero", the shape a setter's
    // `> 0` takes; it is a deliberate departure and is listed, not compared.
    else if (q.codeMin !== Number.MIN_VALUE && q.codeMin !== q.lo)
      out.push(`min ${q.codeMin} against hint ${q.lo}`);
  }
  if (!q.openMax) {
    if (q.codeMax === null) out.push(`hint closes at ${q.hi}, code declares no max`);
    else if (q.codeMax !== q.hi) out.push(`max ${q.codeMax} against hint ${q.hi}`);
  }
  return out;
}

describe('a quoted hint and the bound beside it', () => {
  const quoted = quotedHints();

  it('finds the quoted hints, so an empty sweep cannot pass for a clean one', () => {
    // Exact, not a floor: three is small enough that a drop to two would hide
    // inside any threshold, and this guard reads comments, so deleting one
    // deletes the evidence along with the subject.
    expect(quoted.map((q) => q.label).sort()).toEqual([
      'Environment.tonemap_agx_contrast',
      'Environment.tonemap_agx_white',
      'Environment.tonemap_white',
    ]);
  });

  it('implements every end the hint closes', () => {
    const disagreements = quoted
      .filter((q) => !SETTER_OVERRIDES_HINT.has(q.label))
      .flatMap((q) => departures(q).map((d) => `${q.file}:${q.line} ${q.label}: ${d}`));
    expect(disagreements.sort()).toEqual([]);
  });

  it('holds no override for a property that no longer departs from its hint', () => {
    // An exemption that exempts nothing is the decay every ratchet here guards
    // against: it stops describing reality and waves the next real gap through.
    const seen = new Map(quoted.map((q) => [q.label, q]));
    const dead = [...SETTER_OVERRIDES_HINT.keys()].filter((label) => {
      const q = seen.get(label);
      return q === undefined || departures(q).length === 0;
    });
    expect(dead).toEqual([]);
  });
});
