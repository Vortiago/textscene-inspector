/**
 * One grammar per Godot composite literal, and one way to read its components. Godot
 * parses an int slot with `_parse_construct<int32_t>` (`variant_parser.cpp:552-596`), which
 * takes any number token and narrows it, so `Vector2i(2e1, 0)` loads as `(20, 0)`: a
 * `-?\d+` copy refuses it, and `parseInt` on a capture reads `2e1` as 2 and `inf` as NaN.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { stripComments } from '@textscene/dev-kit';
import { relative } from 'node:path';
import { allSourceFiles, srcRoot } from './testing/ruleNameScrape.js';
import { makeFloatTupleRegex } from './validators/floatTupleValidator.js';
import { slotTupleRegex, variantTupleRegex } from '../godot/number.js';

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
 * A composite name inside a regex, found by extracting the regex literals and `new RegExp`
 * arguments, so `/^Vector2i\s*\(/`, `/^(Vector2i)\(/` and `new RegExp('^Vector2i\\(')` all
 * count. A required closing delimiter keeps prose out. Both canonical builders interpolate
 * the type name, so neither spells one, and the allowlist is empty.
 */
const COMPOSITE_NAME = new RegExp(`(?:${COMPOSITES.join('|')})`);
const REGEX_LITERAL = /\/(?![/*])((?:[^/\\\n[]|\\.|\[(?:[^\]\\]|\\.)*\])+)\/[dgimsuvy]*/g;
const REGEXP_CTOR = /new RegExp\(\s*(['"`])((?:[^\\]|\\.)*?)\1/g;

/**
 * `${…}` interpolations blanked. A composite name passed into a canonical builder
 * (`packedArrayCallAnywhere('PackedVector3Array')`) is an argument, not a spelled
 * grammar, and composing the shared helper is the pattern this guard wants.
 */
function withoutInterpolations(src: string): string {
  return src.replace(/\$\{[^}]*\}/g, '');
}

/**
 * A quote inside the candidate, which makes it prose, not a grammar: `REGEX_LITERAL` reads
 * any `/` as a delimiter, and a string such as an `accepts` sentence may hold two. Blanking
 * strings first would hide a regex that holds a quote, and every {@link COMPOSITES} name is
 * a numeric tuple, so no grammar for one spells a quote.
 */
const QUOTE = /['"`]/;

/**
 * The offending pattern text, or `null` when the file spells no composite in a regex.
 * Source text, not behaviour: a second copy is wrong only where the copies disagree. No
 * exemption: the builders take a type name and an arity, so they express every composite.
 */
function handRolledComposite(source: string): string | null {
  const src = withoutInterpolations(stripComments(source));
  for (const m of src.matchAll(REGEX_LITERAL)) {
    if (COMPOSITE_NAME.test(m[1]!) && !QUOTE.test(m[1]!)) return m[0];
  }
  for (const m of src.matchAll(REGEXP_CTOR)) if (COMPOSITE_NAME.test(m[2]!)) return m[0];
  return null;
}

/**
 * Whoever imports the linter's tuple builder, derived, not listed: files build a tuple
 * regex under local names, and an import cannot be renamed out of. `VECTOR2_REGEX` and
 * `VECTOR3_REGEX` count, since they read the same captures. An `import`, not the bare
 * name, since `godot/number.ts` names the builder in a docblock.
 */
const IMPORTS_TUPLE_BUILDER =
  /import\s[^;]*\b(?:makeFloatTupleRegex|VECTOR2_REGEX|VECTOR3_REGEX)\b/;

/**
 * Reading a matched capture without the shared reader, `storedInt` or `matchedFloat`
 * (`godot/`), which read exactly what the matching grammar admits. No file in the
 * population needs `Number(` either, so the ban has no allowlist.
 */
const RAW_NUMBER_PARSE = /\b(?:parseInt|parseFloat|Number)\(/;

/**
 * Reading a Variant number with the language's parser instead of Godot's, tree-wide: the
 * previewer's decoders read the same text as the linter (`item_count = 2e1` is twenty
 * items). The named readers are `matchedFloat` and `storedInt` for a vetted capture, and
 * `parseGodotFloat`/`parseGodotInt` for the rest.
 */
const RAW_VARIANT_PARSE =
  /\bparseFloat\(|\bparseInt\((?![^()]*(?:\([^()]*\)[^()]*)*,\s*(?:2|8|16)\s*\))/;

/**
 * A file that rebuilds the shared scalar grammar into its own `RegExp`, such as
 * `new RegExp('^' + FLOAT_PATTERN_SOURCE + '$')` read with `parseFloat`: a second reader of
 * one grammar. Composites go through `slotTupleRegex`, and a scalar through `parseGodotFloat`.
 */
const REBUILDS_SCALAR_GRAMMAR = /new RegExp\([^)]*FLOAT_PATTERN_SOURCE/;

/**
 * Whoever reads a packed array, derived the same way: the file composes a shared builder
 * or the form set and body reader built on them, so a rewrite between the four spellings
 * stays in the population.
 */
const PACKED_ARRAY_READERS =
  /\b(?:packedArrayLiteral|packedArrayCallAnywhere|packedArrayForms|packedArrayBody)\(/;
/**
 * `parseInt` only: `parseFloat` is right for a packed float element the finite grammar
 * matched (`resources/shapes/packedArray.ts`). An int element goes through
 * `_parse_construct<int32_t>` (`variant_parser.cpp:1428-1430`), so `PackedInt32Array(2e1, 0, 0)`
 * places a tile at 20, and the `inf` `rtos_fix` writes must not NaN the decode.
 */
const RAW_INT_PARSE = /\bparseInt\(/;

/**
 * A resource-reference literal asked for with a membership test, which neither regex scan
 * sees. `get_token` discards every character <= 32 before a token (variant_parser.cpp:415-417),
 * and the reference branch asks only for the next token to be `(` (:1089-1093), so
 * `ExtResource ("id")` loads and `dataStr.includes('ExtResource(')` misses it.
 */
const REFERENCE_LITERAL_NAME = /(?:SubResource|ExtResource|NodePath)\s*\(/;
/**
 * Scoped to reference literals: `bbcode.tsx` tests a `Color(` prefix and `intSlotProbe.ts`
 * reads an `accepts` description legitimately, and this family carries no exemptions.
 */
const MEMBERSHIP_TEST =
  /\.(?:includes|startsWith|endsWith|indexOf|lastIndexOf)\(\s*(['"`])((?:[^\\]|\\.)*?)\1/g;

/** The offending call text, or `null` when the source spells no reference this way. */
function membershipTestedReference(source: string): string | null {
  for (const m of stripComments(source).matchAll(MEMBERSHIP_TEST)) {
    if (REFERENCE_LITERAL_NAME.test(m[2]!)) return m[0];
  }
  return null;
}

/**
 * The composites whose slot narrows every component to `int32_t`. Derived from
 * `COMPOSITES`, where no other name ends in `i`.
 */
const I_SUFFIXED = COMPOSITES.filter((name) => name.endsWith('i'));

/**
 * Whoever reads a component out of an `i`-suffixed slot grammar. A slot also takes the
 * converted spelling (`compositeSpellings`), whose components are doubles: measured on 4.6.3,
 * `Vector2(4294967295, 64)` in a `Vector2i` slot stores `(-2147483648, 64)` where
 * `Vector2i(4294967295, 64)` stores `(-1, 64)`, so `storedInt`/`ruleInt` need the flag.
 */
const BUILDS_I_SLOT_GRAMMAR = new RegExp(
  String.raw`\b(?:slotTupleRegex|makeFloatTupleRegex)\(\s*['"](?:${I_SUFFIXED.join('|')})['"]`
);
/**
 * A grammar bound to a name, the second way in, so no roster of names exists. Out:
 * `variantTupleRegex`, which refuses the converted spelling (`nodes/animation/animationplayer/animationResolver.ts`),
 * and a file routing through a shared reader, which carries the flag once for all.
 */
const I_SLOT_CONSTANT = new RegExp(
  String.raw`\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:slotTupleRegex|makeFloatTupleRegex)\(\s*['"](?:${I_SUFFIXED.join('|')})['"]`,
  'g'
);

/** Where `alwaysFloatBranch` sits in each reader's argument list (`godot/intSlots.ts`). */
const CONVERTED_ARG: Readonly<Record<string, number>> = { storedInt: 1, ruleInt: 3 };

/**
 * A first argument that is a matched capture, `match[1]`-shaped, the one read shape this
 * scan sees. `linter/validators/v/vectors.ts` reads its `Rect2i` components through a
 * callback's bare identifier, held by the `isConvertedSpelling` term at file granularity,
 * so a second bare `ruleInt(c)` there would pass both terms.
 */
const CAPTURE_ARG = /^[A-Za-z_$][\w$]*\[\d+\]/;

/** Top-level arguments of every `fn(…)` call, with the offset the call starts at. */
function readerCalls(src: string, fn: string): Array<{ args: string[]; index: number }> {
  const calls: Array<{ args: string[]; index: number }> = [];
  const opener = new RegExp(String.raw`\b${fn}\(`, 'g');
  for (let m = opener.exec(src); m !== null; m = opener.exec(src)) {
    const args: string[] = [];
    let arg = '';
    let depth = 1;
    for (let i = opener.lastIndex; i < src.length; i++) {
      const ch = src[i]!;
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') depth--;
      if (depth === 0) break;
      if (ch === ',' && depth === 1) {
        args.push(arg.trim());
        arg = '';
        continue;
      }
      arg += ch;
    }
    args.push(arg.trim());
    calls.push({ args, index: m.index });
  }
  return calls;
}

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
  // Read, comment-stripped and labelled once for every assertion. Comments go because
  // a docblock's opening and closing delimiters pair into false regexes around prose.
  const files = allSourceFiles().map((file) => {
    const src = readFileSync(file, 'utf8');
    return { rel: label(file), src, bare: stripComments(src) };
  });

  it('is spelled by the two canonical builders, never by a regex literal', () => {
    const offenders = files
      .filter(({ src }) => handRolledComposite(src) !== null)
      .map(({ rel }) => rel)
      .sort();
    expect(offenders).toEqual([]);
  });

  // The detector's own failure mode, pinned because no source file exercises it:
  // prose that spells a composite between two slashes in a string.
  it('tells a grammar from prose that merely spells one', () => {
    const prose =
      "validator.accepts = 'leaf `name` (no `:` or `/`), `rest` (Transform3D), `position`/`scale` (Vector3)';";
    expect(handRolledComposite(prose)).toBeNull();

    // Still caught, so the quote rule narrows the detector rather than blunting it.
    const grammar = 'const RE = /^Transform3D\\(\\s*(-?\\d+)\\s*\\)$/;';
    expect(handRolledComposite(grammar)).not.toBeNull();
  });

  it('reads a matched component through the shared reader, never a raw parse', () => {
    // The renderer's `slotTupleRegex` consumers are held elsewhere: `RAW_VARIANT_PARSE`
    // bans `parseInt`/`parseFloat` outside `godot/`, and the i-suffixed assertion owns
    // the converted spelling a slot grammar adds.
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
    // A raw `parseFloat` on an already-matched capture is correct in the decoders.
    // Rebuilding the grammar to feed one creates a second reader that can diverge
    // from `parseGodotFloat`.
    expect(files.length).toBeGreaterThan(1000);
    const offenders = files
      .filter(({ rel, bare }) => !rel.startsWith('godot/') && REBUILDS_SCALAR_GRAMMAR.test(bare))
      .map(({ rel }) => rel)
      .sort();
    expect(offenders).toEqual([]);
  });

  it('reads a Variant number through the shared reader, everywhere', () => {
    // `godot/` holds the shared readers: the complement, not an exemption. `Number(`
    // stays legal for a key index (`tab_7/title`) already matched to `-?\d+`, and a
    // non-decimal `parseInt(seq, 16)` decodes a `\uXXXX` escape, so only decimal is banned.
    const population = files.filter(({ rel }) => !rel.startsWith('godot/'));
    expect(population.length).toBeGreaterThan(1000);

    const offenders = population
      .filter(({ bare }) => RAW_VARIANT_PARSE.test(bare))
      .map(({ rel }) => rel)
      .sort();
    expect(offenders).toEqual([]);
  });

  it('never asks for a resource reference with a membership test', () => {
    // `godot/` is the complement, not an exemption: the shared discriminators
    // and bodies live there and are the only place one may be spelled.
    const population = files.filter(({ rel }) => !rel.startsWith('godot/'));
    expect(population.length).toBeGreaterThan(1000);

    const offenders = population
      .filter(({ src }) => membershipTestedReference(src) !== null)
      .map(({ rel }) => rel)
      .sort();
    expect(offenders).toEqual([]);
  });

  // The detector's own edges, pinned because no source file exercises them.
  it('tells a membership-tested reference from a key prefix that merely shares a word', () => {
    expect(membershipTestedReference("value.includes('ExtResource(')")).not.toBeNull();
    expect(membershipTestedReference('raw.startsWith("NodePath (")')).not.toBeNull();
    expect(membershipTestedReference("key.startsWith('libraries/')")).toBeNull();
    // A composite is another assertion's subject, and legitimately spelled here.
    expect(membershipTestedReference("value.startsWith('Color(')")).toBeNull();
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

  it('reads an i-suffixed slot capture through the converted branch', () => {
    const bound = new Set<string>();
    for (const { bare } of files) for (const m of bare.matchAll(I_SLOT_CONSTANT)) bound.add(m[1]!);
    // Anti-vacuity, and load-bearing: an empty alternation below would be
    // `\b(?:)\b`, which matches every file with a word in it.
    expect(bound.size).toBeGreaterThan(0);
    const named = new RegExp(String.raw`\b(?:${[...bound].join('|')})\b`);

    const population = files.filter(
      ({ bare }) => BUILDS_I_SLOT_GRAMMAR.test(bare) || named.test(bare)
    );
    // Anti-vacuity: the population is scraped, so a rename could empty it. Source text
    // has to ask: only a whole token in `[2^31, 2^32-1]` tells the branches apart, and a
    // `.` or `e` token already takes the double branch.
    expect(population.length).toBeGreaterThan(3);

    const offenders: string[] = [];
    for (const { rel, bare } of population) {
      if (!bare.includes('isConvertedSpelling(')) {
        offenders.push(`${rel}: never asks isConvertedSpelling`);
      }
      for (const [reader, flagAt] of Object.entries(CONVERTED_ARG)) {
        for (const { args, index } of readerCalls(bare, reader)) {
          if (!CAPTURE_ARG.test(args[0] ?? '') || args.length > flagAt) continue;
          // Offsets survive `stripComments`, which blanks in place and keeps both
          // length and newlines, so this is the line in the real file.
          const line = bare.slice(0, index).split('\n').length;
          offenders.push(`${rel}:${line} ${reader}(${args[0]}) takes no converted flag`);
        }
      }
    }
    expect(offenders.sort()).toEqual([]);
  });

  /**
   * The two builders differ only in component grammar (the linter's admits `inf`/`nan`),
   * never in padding: `_parse_construct` takes `TK_PARENTHESIS_OPEN` from its own
   * `get_token` (variant_parser.cpp:553-557), which drops characters <= 32 (:416-418), so
   * `Vector2 (1, 2)` loads. Probes stay finite, since full equality is not the invariant.
   */
  it.each(ARITIES)('%s: both builders take the same padding', (name, arity) => {
    const zeros = Array.from({ length: arity }, () => '0').join(', ');
    const linter = makeFloatTupleRegex(name, arity);
    const renderer = slotTupleRegex(name, arity);
    for (const literal of [`${name}(${zeros})`, `${name} (${zeros})`, `${name}\t(${zeros})`]) {
      expect({ literal, linter: linter.test(literal) }).toEqual({
        literal,
        linter: renderer.test(literal),
      });
    }
  });

  /**
   * And the same type names, which the padding probe cannot see: both read
   * `compositeSpellings`, so a slot accepts every spelling `can_convert_strict` converts
   * into it. Probing only the canonical name would let either side narrow unseen.
   */
  it.each(ARITIES)('%s: both builders take the same convertible spellings', (name, arity) => {
    const zeros = Array.from({ length: arity }, () => '0').join(', ');
    const linter = makeFloatTupleRegex(name, arity);
    const renderer = slotTupleRegex(name, arity);
    for (const spelling of COMPOSITES) {
      const literal = `${spelling}(${zeros})`;
      expect({ literal, linter: linter.test(literal) }).toEqual({
        literal,
        linter: renderer.test(literal),
      });
    }
  });

  it('the variant builder refuses the spellings the slot builder converts', () => {
    // `variantTupleRegex` is for a value that is not a property write: an animation
    // keyframe is a Variant of the type the file spells.
    expect(slotTupleRegex('Vector3i', 3).test('Vector3(1, 2, 3)')).toBe(true);
    expect(variantTupleRegex('Vector3i', 3).test('Vector3(1, 2, 3)')).toBe(false);
    expect(variantTupleRegex('Vector3i', 3).test('Vector3i(1, 2, 3)')).toBe(true);
  });
});
