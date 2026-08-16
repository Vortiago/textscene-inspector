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
import { stripComments } from '@textscene/dev-kit';
import { relative } from 'node:path';
import { allSourceFiles, srcRoot } from './testing/ruleNameScrape.js';
import { makeFloatTupleRegex } from './validators/floatTupleValidator.js';
import { finiteTupleRegex } from '../godot/number.js';

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
 * A composite name spelled inside a REGEX, however the author wrote it.
 *
 * Matching the name followed by an escaped paren caught one spelling and missed
 * three that a reviewer produced on the first try: `/^Vector2i\s*\(/`,
 * `/^(Vector2i)\(/` and `new RegExp('^Vector2i\\(')`. The first is how the code
 * this guard replaced was actually written, so the guard would not have caught
 * its own subject.
 *
 * So the pattern is extracted rather than described: find the regex literals
 * and `new RegExp` string arguments on their own terms, then ask whether any
 * names a composite. Requiring a CLOSING delimiter is what keeps prose out —
 * `// a Transform2D there …` has no second `/` on the line, and a docblock's
 * `* Godot Transform3D (basis rows …)` has none at all.
 *
 * Both canonical builders interpolate the type name, so neither contains a
 * literal composite name and neither needs exempting. The allowlist is empty
 * because nothing legitimate spells one.
 */
const COMPOSITE_NAME = new RegExp(`(?:${COMPOSITES.join('|')})`);
const REGEX_LITERAL = /\/(?![/*])((?:[^/\\\n[]|\\.|\[(?:[^\]\\]|\\.)*\])+)\/[dgimsuvy]*/g;
const REGEXP_CTOR = /new RegExp\(\s*(['"`])((?:[^\\]|\\.)*?)\1/g;

/**
 * Comments removed, because a regex literal never lives inside one and a
 * comment's own delimiters pair up into false regexes: the `/` of `/**` and the
 * `/` of `*` + `/` bracket a docblock's prose, so any paragraph mentioning a
 * composite read as a hand-rolled grammar. Line comments require whitespace
 * before the `//` so an escaped `\/\/` inside a real pattern survives.
 */
const withoutComments = stripComments;

/**
 * `${…}` interpolations blanked. A composite name passed INTO a canonical
 * builder (`packedArrayCallAnywhere('PackedVector3Array')`) is an argument, not
 * a spelled grammar — composing the shared helper is the pattern this guard
 * wants, so it must not read as the thing it forbids.
 */
function withoutInterpolations(src: string): string {
  return src.replace(/\$\{[^}]*\}/g, '');
}

/** The offending pattern text, or `null` when the file spells no composite in a regex. */
function handRolledComposite(source: string): string | null {
  const src = withoutInterpolations(withoutComments(source));
  for (const m of src.matchAll(REGEX_LITERAL)) if (COMPOSITE_NAME.test(m[1]!)) return m[0];
  for (const m of src.matchAll(REGEXP_CTOR)) if (COMPOSITE_NAME.test(m[2]!)) return m[0];
  return null;
}

/**
 * Whoever IMPORTS the linter's tuple builder, derived rather than listed.
 *
 * This was a roster of three regex names, which is an exemption list written as
 * an inclusion list: four files build a tuple regex under a local name
 * (`node2dGlobalTransform`, `basisColumnScales`, `rigidBodyLinterRule`,
 * `bone2d/linter`) and every one of them was outside it, so a `parseFloat` on a
 * matched capture in any of the four left this green — the guard's own defect
 * class, invisible to the guard. Importing the builder is the property that
 * actually matters, and it cannot be renamed out of.
 *
 * The renderer's `finiteTupleRegex` consumers are deliberately NOT here: their
 * grammar is finite, so a matched capture always reads back through `parseFloat`
 * and there is nothing to get wrong. `godot/number.ts` mentions the linter
 * builder only in a docblock, which is why this matches an `import` and not the
 * bare name.
 */
const IMPORTS_TUPLE_BUILDER = /import\s[^;]*\bmakeFloatTupleRegex\b/;

/**
 * Reading a matched capture without the shared reader. `Number(` is in the ban
 * because the line this guard was written after was literally
 * `Number(match[1])`; no file in the population above needs it for anything
 * else, so the ban is absolute rather than carrying an allowlist.
 */
const RAW_NUMBER_PARSE = /\b(?:parseInt|parseFloat|Number)\(/;

/**
 * Where a Variant VALUE is read to decide a diagnostic: all of `src/linter/`,
 * plus every `linter*.ts` beside a slice.
 *
 * Wider than the builder-derived population above, and banning less. A rule
 * reads a scalar straight out of `node.properties`, with no tuple regex
 * anywhere, so importing the builder is not the property that finds it — and a
 * scalar read is exactly where `parseInt` costs the most: it stops at the first
 * unusable character, so `tab_count = 2e1` came back as 2 and the error-tier
 * `tabbar-current-tab-out-of-range` fired on a file Godot loads with twenty
 * tabs.
 *
 * `Number(` is deliberately NOT banned here. It has a second, correct use in
 * this population that the narrower one does not: scraping the index out of a
 * property KEY (`tab_7/title`), whose grammar is `String::is_valid_int` and
 * whose capture is already `-?\d+`. Routing those through a Variant reader
 * would be a worse abstraction, not a stricter one.
 */
const isDiagnosticReader = (rel: string): boolean =>
  rel.startsWith('linter/') || /(?:^|\/)linter[^/]*\.tsx?$/.test(rel);

/**
 * A file that rebuilds the shared scalar grammar into its own `RegExp`.
 *
 * The one shape that puts a SECOND reader of the same grammar in the tree, and
 * the one this guard could not see while its population was `linter/` only:
 * `parser/valueParsers.ts` did `new RegExp('^' + FLOAT_PATTERN_SOURCE + '$')`
 * and read the match with a bare `parseFloat` — behaviourally `parseGodotFloat`
 * filtered to finite, one exemption further from the shared one. Composites go
 * through `finiteTupleRegex`; a scalar goes through `parseGodotFloat`.
 */
const REBUILDS_SCALAR_GRAMMAR = /new RegExp\([^)]*FLOAT_PATTERN_SOURCE/;
const RAW_SCALAR_PARSE = /\b(?:parseInt|parseFloat)\(/;

/**
 * Whoever reads a PACKED array, derived the same way: the file composes one of
 * the two shared builders.
 *
 * `parseInt` only. `parseFloat` is the CORRECT reader for a packed FLOAT array
 * once the element has matched the finite grammar, which is what
 * `resources/shapes/packedArray.ts` does. An INT array is the one that cannot
 * use it: Godot reads those elements with `_parse_construct<int32_t>`
 * (`variant_parser.cpp:1428-1430`), which takes any number token and narrows
 * it, so `PackedInt32Array(2e1, 0, 0)` places a tile at 20 and `parseInt` put
 * it at 2 — or, on the `inf` that `rtos_fix` writes, NaN'd the whole decode and
 * reported `tilemap-invalid-tile-data` on a file Godot loads.
 */
const PACKED_ARRAY_READERS = /\b(?:packedArrayLiteral|packedArrayCallAnywhere)\(/;
const RAW_INT_PARSE = /\bparseInt\(/;

/**
 * Each composite at the arity Godot writes it with, for the parity probe below.
 * `Plane` is 4 (normal xyz + d); `AABB` is position + size.
 */
const ARITIES: ReadonlyArray<readonly [string, number]> = [
  ['Vector2', 2], ['Vector2i', 2],
  ['Vector3', 3], ['Vector3i', 3],
  ['Vector4', 4], ['Vector4i', 4],
  ['Rect2', 4], ['Rect2i', 4],
  ['Color', 4], ['Quaternion', 4], ['Plane', 4],
  ['AABB', 6], ['Transform2D', 6],
  ['Basis', 9], ['Transform3D', 12], ['Projection', 16],
];

describe('Godot composite literal grammar', () => {
  // Read, comment-stripped and labelled ONCE. Four assertions ask about the
  // same ~1,980 modules, and doing the strip per assertion re-walked 4.7 MB of
  // source two and a half times over for an answer that cannot have changed.
  const files = allSourceFiles().map((file) => {
    const src = readFileSync(file, 'utf8');
    return { rel: label(file), src, bare: withoutComments(src) };
  });

  it('is spelled by the two canonical builders, never by a regex literal', () => {
    const offenders = files
      .filter(({ src }) => handRolledComposite(src) !== null)
      .map(({ rel }) => rel)
      .sort();
    expect(offenders).toEqual([]);
  });

  it('reads a matched component through the shared reader, never a raw parse', () => {
    const importers = files.filter(
      ({ rel, src }) =>
        IMPORTS_TUPLE_BUILDER.test(src) && rel !== 'linter/validators/floatTupleValidator.ts'
    );
    // Anti-vacuity: the population is derived, so a refactor that stopped every
    // file importing the builder would empty it and leave this trivially green.
    expect(importers.length).toBeGreaterThan(5);

    const offenders = importers
      .filter(({ src }) => RAW_NUMBER_PARSE.test(src))
      .map(({ rel }) => rel)
      .sort();
    expect(offenders).toEqual([]);
  });

  it('never rebuilds the scalar grammar outside godot/, at any depth', () => {
    // The reach the `linter/`-scoped assertion below does NOT have. A raw
    // `parseFloat` on an already-matched capture is correct and common in the
    // decoders; rebuilding the GRAMMAR to feed one is what creates a second
    // reader that can drift from `parseGodotFloat`.
    expect(files.length).toBeGreaterThan(1000);
    const offenders = files
      .filter(({ rel, bare }) => !rel.startsWith('godot/') && REBUILDS_SCALAR_GRAMMAR.test(bare))
      .map(({ rel }) => rel)
      .sort();
    expect(offenders).toEqual([]);
  });

  it('reads a Variant scalar through the shared reader, in every rule', () => {
    // No allowlist. `parseGodotFloat` — whose last step is the `parseFloat`
    // this bans — lives in `godot/number.ts`, outside this population, so the
    // one file that legitimately spells it is not a file this asks about.
    const population = files.filter(({ rel }) => isDiagnosticReader(rel));
    // Anti-vacuity: the population is a path predicate, so a change to how
    // `label` spells a path would empty it and leave this green forever.
    expect(population.length).toBeGreaterThan(200);

    const offenders = population
      .filter(({ bare }) => RAW_SCALAR_PARSE.test(bare))
      .map(({ rel }) => rel)
      .sort();
    expect(offenders).toEqual([]);
  });

  it('reads a packed INT element through the shared reader, never parseInt', () => {
    const population = files.filter(({ bare }) => PACKED_ARRAY_READERS.test(bare));
    // Anti-vacuity: the population is builder-derived, so a rename that stopped
    // every file composing one would empty it and leave this green.
    expect(population.length).toBeGreaterThan(10);

    const offenders = population
      .filter(({ bare }) => RAW_INT_PARSE.test(bare))
      .map(({ rel }) => rel)
      .sort();
    expect(offenders).toEqual([]);
  });

  /**
   * The two builders differ ONLY in component grammar — the linter's admits
   * `inf`/`nan`, the renderer's does not — and never in the whitespace around
   * the constructor. The type name and the `(` are separate tokens:
   * `_parse_construct` takes `TK_PARENTHESIS_OPEN` from its own `get_token`
   * call (variant_parser.cpp:553-557), and `get_token` discards every character
   * <= 32 before a token (:416-418), so `Vector2 (1, 2)` is a file Godot loads.
   *
   * Source text cannot see this: both builders are single canonical functions,
   * so the two assertions above are green while the languages disagree. Probes
   * stay finite-valued, because full language equality is NOT the invariant.
   */
  it.each(ARITIES)('%s: both builders take the same padding', (name, arity) => {
    const zeros = Array.from({ length: arity }, () => '0').join(', ');
    const linter = makeFloatTupleRegex(name, arity);
    const renderer = finiteTupleRegex(name, arity);
    for (const literal of [`${name}(${zeros})`, `${name} (${zeros})`, `${name}\t(${zeros})`]) {
      expect({ literal, linter: linter.test(literal) }).toEqual({
        literal,
        linter: renderer.test(literal),
      });
    }
  });
});
