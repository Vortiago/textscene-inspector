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
 * capture must go through `storedInt` / `matchedFloat` (`godot/`), which read
 * exactly what the grammar that matched it admits.
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

/**
 * `${…}` interpolations blanked. A composite name passed INTO a canonical
 * builder (`packedArrayCallAnywhere('PackedVector3Array')`) is an argument, not
 * a spelled grammar — composing the shared helper is the pattern this guard
 * wants, so it must not read as the thing it forbids.
 */
function withoutInterpolations(src: string): string {
  return src.replace(/\$\{[^}]*\}/g, '');
}

/**
 * A quote inside the candidate, which makes it prose rather than a grammar.
 *
 * `REGEX_LITERAL` reads `/` as a delimiter wherever it stands, and a STRING may
 * hold two of them: the `accepts` sentence on `skeleton3d`'s bone dispatcher
 * says ``no `:` or `/`), … `rest` (Transform3D), … `position`/`scale``, whose
 * two slashes bracket a span containing `Transform3D` and read as a hand-rolled
 * Transform3D grammar.
 *
 * Blanking string literals first would trade this for the mirror-image bug,
 * since a regex may itself contain a quote and would then be the thing hidden.
 * Every name in {@link COMPOSITES} is a NUMERIC tuple — `Vector3(1, 2, 3)`,
 * `Color(1, 1, 1, 1)` — so no grammar for one has any reason to spell a quote,
 * while prose about them constantly does.
 */
const QUOTE = /['"`]/;

/** The offending pattern text, or `null` when the file spells no composite in a regex. */
function handRolledComposite(source: string): string | null {
  const src = withoutInterpolations(stripComments(source));
  for (const m of src.matchAll(REGEX_LITERAL)) {
    if (COMPOSITE_NAME.test(m[1]!) && !QUOTE.test(m[1]!)) return m[0];
  }
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
 * actually matters, and it cannot be renamed out of. The shared `VECTOR2_REGEX`
 * / `VECTOR3_REGEX` count as importing it: a file that stops rebuilding the
 * grammar and reaches for the constant instead still reads the same captures,
 * and must not fall out of the population by doing the right thing.
 *
 * The renderer's `slotTupleRegex` consumers are deliberately NOT here; they are
 * held by two other assertions instead. `RAW_VARIANT_PARSE` bans
 * `parseInt`/`parseFloat` outside `godot/` tree-wide, and the i-suffixed
 * assertion below owns the one thing a SLOT grammar adds over a finite one — a
 * converted spelling whose components are doubles. `godot/number.ts` mentions
 * the linter builder only in a docblock, which is why this matches an `import`
 * and not the bare name.
 */
const IMPORTS_TUPLE_BUILDER =
  /import\s[^;]*\b(?:makeFloatTupleRegex|VECTOR2_REGEX|VECTOR3_REGEX)\b/;

/**
 * Reading a matched capture without the shared reader. `Number(` is in the ban
 * because the line this guard was written after was literally
 * `Number(match[1])`; no file in the population above needs it for anything
 * else, so the ban is absolute rather than carrying an allowlist.
 */
const RAW_NUMBER_PARSE = /\b(?:parseInt|parseFloat|Number)\(/;

/**
 * Reading a Variant number with the LANGUAGE's parser instead of Godot's.
 *
 * Tree-wide, and with no allowlist. Scoped to `src/linter/` this asked only
 * whether a DIAGNOSTIC read a value wrongly, which is half the question: the
 * previewer reads the same text through its own decoders, and thirteen of them
 * were doing it with `parseInt`/`parseFloat` — `item_count = 2e1` built two
 * items where Godot builds twenty, `tile_layout = 1e1` decoded to a different
 * enum member than Godot stores, and a `Curve`'s `_limits` read `1abc` as 1 and
 * scaled every sample by it. A linter that is right while the render path beside
 * it is wrong is the divergence this whole guard family exists to close.
 *
 * The two legitimate readers are NAMED rather than exempted, which is what lets
 * the ban be absolute: `matchedFloat` and `storedInt` (`godot/`) take a capture
 * a finite grammar has already vetted, and everything else goes through
 * `parseGodotFloat`/`parseGodotInt`. A roster of safe call sites would have to
 * be re-derived on every refactor; a named reader cannot be renamed out of.
 *
 * `Number(` stays legal: scraping the index out of a property KEY (`tab_7/title`)
 * has grammar `String::is_valid_int` and a capture already matched to `-?\d+`,
 * and routing that through a Variant reader would be a worse abstraction, not a
 * stricter one.
 *
 * A non-decimal radix is not number parsing at all — `parseInt(seq, 16)` decodes
 * a `\uXXXX` character escape — so the ban is on the decimal spellings only.
 */
const RAW_VARIANT_PARSE =
  /\bparseFloat\(|\bparseInt\((?![^()]*(?:\([^()]*\)[^()]*)*,\s*(?:2|8|16)\s*\))/;

/**
 * A file that rebuilds the shared scalar grammar into its own `RegExp`.
 *
 * The one shape that puts a SECOND reader of the same grammar in the tree, and
 * the one this guard could not see while its population was `linter/` only:
 * `parser/valueParsers.ts` did `new RegExp('^' + FLOAT_PATTERN_SOURCE + '$')`
 * and read the match with a bare `parseFloat` — behaviourally `parseGodotFloat`
 * filtered to finite, one exemption further from the shared one. Composites go
 * through `slotTupleRegex`; a scalar goes through `parseGodotFloat`.
 */
const REBUILDS_SCALAR_GRAMMAR = /new RegExp\([^)]*FLOAT_PATTERN_SOURCE/;

/**
 * Whoever reads a PACKED array, derived the same way: the file composes one of
 * the shared builders, or the form-set and body reader built on them. All four
 * spellings, because a reader that moves from one to another must stay in the
 * population rather than leave it by being rewritten.
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
const PACKED_ARRAY_READERS =
  /\b(?:packedArrayLiteral|packedArrayCallAnywhere|packedArrayForms|packedArrayBody)\(/;
const RAW_INT_PARSE = /\bparseInt\(/;

/**
 * A resource-reference literal asked for with a MEMBERSHIP TEST rather than a
 * grammar — the spelling both scans above are blind to, since neither a regex
 * literal nor a `new RegExp` argument is involved.
 *
 * `dataStr.includes('ExtResource(')` reads as a cheap discriminator and is a
 * tight grammar: `get_token` discards every character <= 32 before a token
 * (variant_parser.cpp:415-417) and the reference branch then asks only for the
 * next token to be `(` (:1089-1093), so `ExtResource ("id")` is a file that
 * loads and that spelling misses it. The two that shipped decided whether to
 * TRUST an enumeration whose own reader was already tolerant, so the
 * suppression failed and `animationplayer-current-animation-missing` fired at
 * error tier on a scene Godot plays.
 *
 * Scoped to the reference literals. A composite membership test is legitimate
 * and present — `bbcode.tsx` discriminates a `Color(` prefix, `intSlotProbe.ts`
 * reads a validator's `accepts` description — and this guard family carries no
 * exemptions, so widening the term to `COMPOSITES` would have to acquire one.
 */
const REFERENCE_LITERAL_NAME = /(?:SubResource|ExtResource|NodePath)\s*\(/;
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
 * Whoever reads a component out of an `i`-suffixed SLOT grammar.
 *
 * A slot grammar takes the converted spelling as well (`compositeSpellings`),
 * and a `Vector2` holds two DOUBLES — so `Vector2(…)` written to a `Vector2i`
 * property converts BOTH components through `double -> int32` however the token
 * was spelled. `storedInt`/`ruleInt` take that branch only when told, and the
 * two branches disagree for exactly one input class: a whole-valued token in
 * `[2^31, 2^32-1]`, which the int branch wraps and the double branch cannot
 * store. Measured on 4.6.3, `Vector2(4294967295, 64)` in a `Vector2i` slot
 * stores `(-2147483648, 64)` where `Vector2i(4294967295, 64)` stores `(-1, 64)`.
 * That narrowness is why source text has to ask: a `.`/`e` token already takes
 * the double branch, so no ordinary value observes the omission.
 *
 * `variantTupleRegex` is out, by name and by meaning: it refuses the converted
 * spelling, so its captures are the i-type's own ints and the flag would be
 * wrong (`nodes/animation/animationplayer/animationResolver.ts`).
 *
 * The population is scraped twice over, because a grammar is reachable two
 * ways — built inline, or referenced under the name it was bound to — and both
 * terms are derived, so no roster of constant names exists to fall out of date.
 * A file that stops touching the grammar and routes through a shared reader
 * leaves the population; that is the intended exit, not an evasion, because the
 * shared reader carries the flag once on behalf of all of them.
 */
const BUILDS_I_SLOT_GRAMMAR = new RegExp(
  String.raw`\b(?:slotTupleRegex|makeFloatTupleRegex)\(\s*['"](?:${I_SUFFIXED.join('|')})['"]`
);
const I_SLOT_CONSTANT = new RegExp(
  String.raw`\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:slotTupleRegex|makeFloatTupleRegex)\(\s*['"](?:${I_SUFFIXED.join('|')})['"]`,
  'g'
);

/** Where `alwaysFloatBranch` sits in each reader's argument list (`godot/int.ts`). */
const CONVERTED_ARG: Readonly<Record<string, number>> = { storedInt: 1, ruleInt: 3 };

/**
 * A first argument that is a matched capture, `match[1]`-shaped.
 *
 * The one read shape this scan can see. `linter/validators/v/vectors.ts` reads
 * its four `Rect2i` components through a `.some((component) => …)` callback,
 * where the argument is a bare identifier; that file is held by the
 * `isConvertedSpelling` term instead, at file granularity. A SECOND reader
 * added there with a bare `ruleInt(c)` would pass both terms. Stated rather
 * than contorted around, the way every population above states its edge.
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
  // Read, comment-stripped and labelled ONCE. Four assertions ask about the
  // same ~1,980 modules, and doing the strip per assertion re-walked 4.7 MB of
  // source two and a half times over for an answer that cannot have changed.
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

  // The detector's own failure mode, pinned because no source file exercises it
  // any more: `skeleton3d`'s `accepts` sentence tripped it, and rewording that
  // one string would have left the next slice to rediscover it.
  it('tells a grammar from prose that merely spells one', () => {
    const prose =
      "validator.accepts = 'leaf `name` (no `:` or `/`), `rest` (Transform3D), `position`/`scale` (Vector3)';";
    expect(handRolledComposite(prose)).toBeNull();

    // Still caught, so the quote rule narrows the detector rather than blunting it.
    const grammar = 'const RE = /^Transform3D\\(\\s*(-?\\d+)\\s*\\)$/;';
    expect(handRolledComposite(grammar)).not.toBeNull();
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

  it('reads a Variant number through the shared reader, everywhere', () => {
    // `godot/` is the population's complement, not an exemption: the shared
    // readers are the four functions that legitimately spell the raw call, and
    // they all live there. Nothing outside it needs one.
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
    // Anti-vacuity: four modules own an i-suffixed slot grammar, and the
    // population is scraped rather than listed, so a rename that hid all four
    // would empty it and leave this trivially green.
    expect(population.length).toBeGreaterThan(3);

    const offenders: string[] = [];
    for (const { rel, bare } of population) {
      if (!bare.includes('isConvertedSpelling(')) {
        offenders.push(`${rel}: never asks isConvertedSpelling`);
      }
      for (const [reader, flagAt] of Object.entries(CONVERTED_ARG)) {
        for (const { args, index } of readerCalls(bare, reader)) {
          if (!CAPTURE_ARG.test(args[0] ?? '') || args.length > flagAt) continue;
          // Offsets survive `stripComments` — it blanks in place, keeping both
          // length and newlines — so this is the line in the real file.
          const line = bare.slice(0, index).split('\n').length;
          offenders.push(`${rel}:${line} ${reader}(${args[0]}) takes no converted flag`);
        }
      }
    }
    expect(offenders.sort()).toEqual([]);
  });

  /**
   * The two builders differ ONLY in component grammar — the linter's admits
   * `inf`/`nan`, the renderer's does not — and never in the type NAME they
   * accept, nor in the whitespace around the constructor. The type name and the `(` are separate tokens:
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
    const renderer = slotTupleRegex(name, arity);
    for (const literal of [`${name}(${zeros})`, `${name} (${zeros})`, `${name}\t(${zeros})`]) {
      expect({ literal, linter: linter.test(literal) }).toEqual({
        literal,
        linter: renderer.test(literal),
      });
    }
  });

  /**
   * And the same TYPE NAMES, which is the axis the padding probe cannot see.
   *
   * Both builders read `compositeSpellings`, so a slot accepts every spelling
   * `can_convert_strict` converts into it. Probing only the canonical name left
   * either side free to narrow with this guard green — and the renderer side
   * had no coverage at all, so dropping the table there would silently return
   * every decoder to falling back on a scene Godot opens.
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
    // `variantTupleRegex` is for a value that is NOT a property write — an
    // animation keyframe is a Variant of the type the file spells. Nothing
    // asserted that it actually refuses the converted spelling.
    expect(slotTupleRegex('Vector3i', 3).test('Vector3(1, 2, 3)')).toBe(true);
    expect(variantTupleRegex('Vector3i', 3).test('Vector3(1, 2, 3)')).toBe(false);
    expect(variantTupleRegex('Vector3i', 3).test('Vector3i(1, 2, 3)')).toBe(true);
  });
});
