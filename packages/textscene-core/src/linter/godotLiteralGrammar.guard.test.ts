/**
 * One grammar per Godot composite literal, and one way to read its components.
 *
 * Both halves of this are the same defect seen from either end, and both shipped:
 *
 * A hand-rolled `/^Vector2i\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)$/` reads as obviously
 * correct and is not. Godot parses an INT slot with `_parse_construct<int32_t>`
 * (`variant_parser.cpp:552-596`), which takes ANY number token and narrows it,
 * so `Vector2i(2e1, 0)` is a file Godot loads as `(20, 0)`. Four copies of that
 * component grammar existed at once — one in a rule, one in the lenient parser,
 * one in a resource decoder — and the linter's copy was widened without the
 * other three, so a value the validator accepted was then refused by the rule
 * sixty lines away and silently drew a default in the previewer.
 *
 * And a widened regex is only half a read. `parseInt` on a matched capture
 * stops at the first character it cannot use: `2e1` comes back as 2 and `inf`
 * as NaN, so a bound compares against a number the file does not contain. The
 * capture must go through `intComponent` / `tupleComponent`, which are derived
 * from the same table as the grammar that matched it.
 *
 * Source text rather than behaviour, deliberately: a second copy is wrong only
 * for the values the two copies disagree about, and nothing observes that until
 * someone writes the fixture. Neither list below has an exemption, and neither
 * should acquire one — the builders take a type name and an arity, so there is
 * no composite either cannot express.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { allSourceFiles, srcRoot } from './testing/ruleNameScrape.js';

/** A file's `src/`-relative path, the form every list below is written in. */
const label = (file: string): string => relative(srcRoot, file).replaceAll('\\', '/');

/** Every composite Godot writes as `TypeName(a, b, …)`. */
const COMPOSITES = [
  'Vector2i',
  'Vector3i',
  'Vector4i',
  'Vector2',
  'Vector3',
  'Vector4',
  'Rect2i',
  'Rect2',
  'Color',
  'AABB',
  'Transform2D',
  'Transform3D',
  'Basis',
  'Quaternion',
  'Plane',
  'Projection',
] as const;

/**
 * A composite name followed by an ESCAPED paren — the signature of a regex
 * spelling the constructor, and of nothing else. A plain string never escapes
 * `(`, and both canonical builders interpolate the type name, so neither owner
 * contains this sequence either. That is why the allowlist is empty rather than
 * naming them.
 */
const HAND_ROLLED = new RegExp(String.raw`(?:${COMPOSITES.join('|')})\\\(`);

/**
 * The linter's component-capturing regexes: derived from Godot's TOKENIZER
 * grammar, so a component may be `inf`, `-inf`, `inf_neg` or `nan`.
 *
 * The renderer's `COLOR_RE` and the vectors behind `parseVector2` are
 * deliberately absent: those use the FINITE grammar, where a matched capture
 * always reads back through `parseFloat` and there is nothing to get wrong.
 */
const NON_FINITE_TUPLE_REGEXES = ['VECTOR2I_REGEX', 'VECTOR2_REGEX', 'VECTOR3_REGEX'];

const RAW_NUMBER_PARSE = /\b(?:parseInt|parseFloat)\(/;

describe('Godot composite literal grammar', () => {
  const files = allSourceFiles().map((file) => ({ file, src: readFileSync(file, 'utf8') }));

  it('is spelled by the two canonical builders, never by a regex literal', () => {
    const offenders = files
      .filter(({ src }) => HAND_ROLLED.test(src))
      .map(({ file }) => label(file))
      .sort();
    expect(offenders).toEqual([]);
  });

  it('reads a matched component through the shared reader, never parseInt/parseFloat', () => {
    const importers = files.filter(({ src }) =>
      NON_FINITE_TUPLE_REGEXES.some((name) => src.includes(name))
    );
    // Anti-vacuity: a rename of any of the three would empty the population and
    // leave the assertion below trivially green.
    expect(importers.length).toBeGreaterThan(5);

    const offenders = importers
      .filter(({ src }) => RAW_NUMBER_PARSE.test(src))
      .map(({ file }) => label(file))
      .sort();
    expect(offenders).toEqual([]);
  });
});
