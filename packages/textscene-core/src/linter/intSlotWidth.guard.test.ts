/**
 * One slot, one width — the parser's read and the validator's declaration may
 * not disagree about it.
 *
 * A slot's `IntWidth` is the C++ type on the far side of the property write, and
 * it is stated TWICE with nothing between the two statements:
 *
 * ```
 * layers: layerBitmask('layers', { hinted: '…', width: 'uint32' })   // validator
 * parseOptionalInt(properties.layers, 'uint32')                      // parser
 * ```
 *
 * They cannot read each other. ADR-0001 keeps the linter out of the webview
 * bundle, so the parser may never import the validator registry, and `src/godot/`
 * — the one module both sides do share — holds the CONVERSION rather than a
 * per-slot table of it: 547 slots declare a width, which is 4.4 KB gzipped
 * shipped to every webview so that the twenty-odd call sites passing a
 * non-default width could look one up.
 * So the two declarations are checked against each other from outside instead,
 * which costs the shipped bundle nothing.
 *
 * The defect this closes is not hypothetical: `intOr` grew a `width` parameter
 * and `parseOptionalInt` did not, so eight bitmask slots the linter declares
 * `uint32` were read as `int32`. `collision_layer = 4294967295` came back as -1,
 * and `layers = 3e9` — a FLOAT literal a uint32 slot holds exactly — came back
 * undefined and rendered as layer 1. The first sweeps found six more, in six
 * files nobody was looking at.
 *
 * ## What it proves, and what it does not
 *
 * Agreement, not correctness. Both sides reading `int32` for a `uint32_t` setter
 * passes here; what catches THAT is the per-property engine citation ADR-0032
 * requires beside the declaration. This guard is the other half: a citation
 * checked on one side only protects that side.
 *
 * ## Why source text
 *
 * The read happens inside a function the registry never sees, so there is no
 * runtime object to ask. Both populations are derived rather than listed — the
 * readers from their own signatures, the call sites from the whole of `src/` —
 * because a roster is the form this defect takes: the shipped bug WAS a list of
 * readers that gained a member nobody added to the other list.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { stripComments } from '@textscene/dev-kit';
import { validatorRegistry } from './ValidatorRegistry.js';
import { CLASS_BASE_TYPES } from '../godot/classBaseTypes.js';
import { classifiableKeys } from './testing/validatorClassification.js';
import { allSourceFiles, srcRoot } from './testing/ruleNameScrape.js';
import type { IntWidth } from '../godot/index.js';
import './index.js'; // side-effect: every slice registers its validators

/**
 * The width a reader applies when the call site names none.
 *
 * Every width-taking reader defaults to `int32`, so an OMITTED argument is a
 * declaration of int32 rather than an absence of one — which is exactly how the
 * eight bitmask slots came to be read at the wrong width while looking clean.
 */
const IMPLIED_WIDTH: IntWidth = 'int32';

const WIDTH_ARGUMENT = /^['"](uint8|int32|uint32|int64)['"]$/;

/**
 * The property bags a slice reads a raw value out of, whatever it calls them.
 *
 * Four spellings for one thing: `properties` (lenient parser), `props` /
 * `rawProps` (rules, reading the same bag off a parsed node) and `data` (a
 * resource decoder's bag). A `[...]` subscript is deliberately NOT matched —
 * the key is then a variable and no cross-check is possible.
 */
const PROPERTY_READ =
  /^\s*(?:[\w.?![\]]*\.)?(?:properties|props|rawProps|rawProperties|data)\??\.(\w+)\b/;

/** A call site's read of one property, as the guard compares it. */
interface IntRead {
  /** `src/`-relative `file:line`, so a failure reads as a work list. */
  where: string;
  reader: string;
  key: string;
  width: IntWidth;
}

/** The balanced argument list of a call whose `(` sits at `open`. */
function argumentsAt(source: string, open: number): string {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const c = source[i];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return '';
}

/**
 * One call's arguments, split at the commas that separate them.
 *
 * Depth- and quote-aware, because an argument is routinely a call of its own
 * (`intOr(properties.amount, clamp(a, b), ctx)`) and routinely a template
 * literal (`` `${context}.seed` ``). Splitting on a bare comma read the second
 * half of both as a fresh argument, which put a width literal in a position the
 * reader never sees it.
 */
function splitArguments(args: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < args.length; i++) {
    const c = args[i]!;
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') quote = c;
    else if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === ',' && depth === 0) {
      parts.push(args.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(args.slice(start).trim());
  return parts;
}

/**
 * Every exported function that takes an {@link IntWidth}, by name.
 *
 * Derived from the signatures rather than listed. The shipped defect was a
 * reader the width never reached, so a hand-written roster of readers has the
 * same blind spot as the bug: `parseOptionalInt` would not have been on it.
 * Whatever names come back are what the sweep below looks for, so a fifth
 * reader is swept the day it is written.
 */
function widthTakingReaders(files: readonly string[]): string[] {
  const names = new Set<string>();
  for (const file of files) {
    const source = stripComments(readFileSync(file, 'utf8'));
    for (const match of source.matchAll(/\bexport function (\w+)\s*(?=\()/g)) {
      const params = argumentsAt(source, match.index + match[0].length);
      if (/\bIntWidth\b/.test(params)) names.add(match[1]!);
    }
  }
  return [...names].sort();
}

/**
 * The property key each local in a file was bound to, `null` where two bindings
 * of one name disagree.
 *
 * A rule routinely lifts the raw text out first — `const collisionMask =
 * rawProps.collision_mask;` — and reads it a few lines down, which put a uint32
 * mask read at int32 outside a sweep that only looked at the argument itself.
 * One hop, and only from a binding whose right-hand side IS the property read:
 * anything derived from it is no longer that slot's text.
 */
function localBindings(source: string): Map<string, string | null> {
  const bound = new Map<string, string | null>();
  for (const match of source.matchAll(/\b(?:const|let|var)\s+(\w+)\s*(?::[^=;\n]+)?=\s*([^;]+);/g)) {
    const key = PROPERTY_READ.exec(match[2]!)?.[1];
    if (key === undefined) continue;
    const name = match[1]!;
    const seen = bound.get(name);
    bound.set(name, seen !== undefined && seen !== key ? null : key);
  }
  return bound;
}

/** Every int read of a named property key, from one file's source. */
export function intReadsIn(source: string, label: string, readers: readonly string[]): IntRead[] {
  if (readers.length === 0) return [];
  const stripped = stripComments(source);
  const calls = new RegExp(`\\b(${readers.join('|')})\\s*(?=\\()`, 'g');
  const bound = localBindings(stripped);
  const reads: IntRead[] = [];
  for (const match of stripped.matchAll(calls)) {
    const args = splitArguments(argumentsAt(stripped, match.index + match[0].length));
    const first = args[0] ?? '';
    // Anything else — a subscript, a parameter, an expression — names no slot,
    // so there is no second declaration to disagree with.
    const key = PROPERTY_READ.exec(first)?.[1] ?? (/^\w+$/.test(first) ? bound.get(first) : undefined);
    if (key === undefined || key === null) continue;
    const width = args
      .map((arg) => WIDTH_ARGUMENT.exec(arg)?.[1] as IntWidth | undefined)
      .find((w) => w !== undefined);
    const line = stripped.slice(0, match.index).split('\n').length;
    reads.push({ where: `${label}:${line}`, reader: match[1]!, key, width: width ?? IMPLIED_WIDTH });
  }
  return reads;
}

/**
 * The class a file speaks for: the nearest ancestor directory Godot knows as a
 * type.
 *
 * A slice directory IS its class (`nodes/3d/decal/`, `resources/noise/
 * fastnoiselite/`), and the ancestry table holds both hierarchies, so the
 * attribution is derived rather than mapped. It matters that it is per CLASS
 * and not per key name: `FastNoiseLite::set_seed` takes `int`
 * (`fastnoise_lite.h:138`) where `CPUParticles2D::set_seed` takes `uint32_t`
 * (`cpu_particles_2d.h:261`), so a name-keyed check calls the correct read of
 * one of them a defect.
 */
export function classOf(label: string, classes: ReadonlyMap<string, string>): string | undefined {
  const dirs = label.split('/').slice(0, -1).reverse();
  for (const dir of dirs) {
    const type = classes.get(dir.toLowerCase());
    if (type !== undefined) return type;
  }
  return undefined;
}

/** What the registry says about one key, across every class that declares it. */
interface Declared {
  widths: Set<IntWidth>;
  types: string[];
}

/**
 * The declaration side, as the comparison asks about it.
 *
 * A seam with two adapters: the live registry, and the synthetic pair the bite
 * test drives. Without it the comparison reached the singleton directly for an
 * attributed read, so the half of it that runs on every slice file was the half
 * no test could pose a question to.
 */
interface Declarations {
  /** The width declared for one class's slot, base chain walked. */
  forClass(type: string, key: string): IntWidth | undefined;
  /** Every width declared for the key name, whoever declares it. */
  forKey(key: string): Declared | undefined;
}

/** The live registry as a {@link Declarations}. */
function registryDeclarations(): Declarations {
  const byKey = new Map<string, Declared>();
  for (const { nodeType, key } of classifiableKeys()) {
    const width = validatorRegistry.findValidator(nodeType, key)?.intSlot?.width;
    if (width === undefined) continue;
    const entry = byKey.get(key) ?? { widths: new Set<IntWidth>(), types: [] };
    entry.widths.add(width);
    entry.types.push(nodeType);
    byKey.set(key, entry);
  }
  return {
    forClass: (type, key) => validatorRegistry.findValidator(type, key)?.intSlot?.width,
    forKey: (key) => byKey.get(key),
  };
}

/** What the sweep found, split by what a reader has to do about it. */
interface Verdicts {
  /** A read and a declaration that disagree — the work list. */
  disagreements: string[];
  /** A read of an ambiguous key from a file no class owns; nothing can check it. */
  unattributable: string[];
  /** Reads compared against a declaration, for the anti-vacuity floor. */
  checked: number;
}

/**
 * Compare one file's reads against what the registry declares.
 *
 * Takes both populations as arguments so the comparison can be driven with a
 * synthetic pair: a guard whose bite is only ever observed on the live tree is
 * one whose bite nobody has observed.
 *
 * A read the owning class does not declare is skipped, not failed. There is
 * genuinely no second declaration then — `MeshInstance3D.gi_lightmap_scale` has
 * no validator yet — and demanding one here would turn a width guard into a
 * coverage guard.
 */
export function verdictsFor(
  reads: readonly IntRead[],
  owner: (label: string) => string | undefined,
  declared: Declarations
): Verdicts {
  const out: Verdicts = { disagreements: [], unattributable: [], checked: 0 };
  for (const read of reads) {
    const entry = declared.forKey(read.key);
    if (entry === undefined) continue;
    const type = owner(read.where.replace(/:\d+$/, ''));
    // A helper shared across a family (`ui/shared/boxContainer.ts`) belongs to
    // no one class, so its read is held to what every class declaring the key
    // agrees on. When they do not agree, the file has to say which slot it
    // reads before the question has an answer at all.
    const own = type === undefined ? undefined : declared.forClass(type, read.key);
    const widths = type === undefined ? entry.widths : new Set(own === undefined ? [] : [own]);
    if (widths.size === 0) continue;
    const call = `${read.reader}(…${read.key})`;
    if (widths.size > 1) {
      out.unattributable.push(
        `${read.where} ${call} sits in no class's directory, and ${read.key} is declared ` +
          `${[...widths].sort().join(' and ')} across ${entry.types.length} classes`
      );
      continue;
    }
    out.checked++;
    const [width] = widths;
    if (width !== read.width) {
      // A family helper answers to every class declaring the key, so naming the
      // first of them would read as one slice's opinion.
      const declarer = type ?? `all ${entry.types.length} classes declaring it`;
      out.disagreements.push(`${read.where} ${call} reads ${read.width}; declared ${width} by ${declarer}`);
    }
  }
  return out;
}

const files = allSourceFiles();
const readers = widthTakingReaders(files);
const classes = new Map(Object.keys(CLASS_BASE_TYPES).map((type) => [type.toLowerCase(), type]));
const label = (file: string): string => relative(srcRoot, file).replaceAll('\\', '/');
const treeReads = files.flatMap((file) => intReadsIn(readFileSync(file, 'utf8'), label(file), readers));
const treeVerdicts = verdictsFor(treeReads, (l) => classOf(l, classes), registryDeclarations());

describe('an int slot is read at the width its validator declares', () => {
  it('finds every reader the width can be passed to', () => {
    // The four a slice actually calls, plus whatever else takes the type. A
    // reader missing from this list is a reader the sweep below cannot see.
    expect(readers).toEqual(expect.arrayContaining(['intOr', 'parseGodotInt', 'parseOptionalInt', 'ruleInt']));
  });

  it('reads a call site the way the reader does', () => {
    const source = [
      "const a = intOr(properties.light_mask, 1, 'ctx');",
      'const b = parseOptionalInt(\n  properties.layers,\n  "uint32"\n);',
      "const c = ruleInt(rawProps.cull_mask, null, 'uint32');",
      'const d = intOr(props.amount, clamp(1, 2), `${ctx}.amount`);',
      "const e = parseOptionalInt(properties[key], 'uint32');",
      'const raw = rawProps.collision_mask;',
      'const f = ruleInt(raw);',
      "// intOr(properties.commented, 0, 'uint32')",
    ].join('\n');
    expect(intReadsIn(source, 'f.ts', ['intOr', 'parseOptionalInt', 'ruleInt'])).toEqual([
      { where: 'f.ts:1', reader: 'intOr', key: 'light_mask', width: 'int32' },
      { where: 'f.ts:2', reader: 'parseOptionalInt', key: 'layers', width: 'uint32' },
      { where: 'f.ts:6', reader: 'ruleInt', key: 'cull_mask', width: 'uint32' },
      { where: 'f.ts:7', reader: 'intOr', key: 'amount', width: 'int32' },
      // One hop through a local: the binding names the slot, the call does not.
      { where: 'f.ts:10', reader: 'ruleInt', key: 'collision_mask', width: 'int32' },
    ]);
  });

  const synthetic: Declarations = {
    forClass: (type, key) => (key === 'layers' && type === 'MeshInstance3D' ? 'uint32' : undefined),
    forKey: (key) =>
      key === 'layers'
        ? { widths: new Set<IntWidth>(['uint32']), types: ['VisualInstance3D', 'MeshInstance3D'] }
        : key === 'light_mask'
          ? { widths: new Set<IntWidth>(['int32', 'uint32']), types: ['CanvasItem', 'Light3D'] }
          : undefined,
  };

  it('names a disagreement on a slot its own class declares', () => {
    const reads: IntRead[] = [
      { where: 'nodes/3d/meshinstance3d/parser.ts:80', reader: 'parseOptionalInt', key: 'layers', width: 'int32' },
      { where: 'nodes/3d/meshinstance3d/parser.ts:81', reader: 'parseOptionalInt', key: 'layers', width: 'uint32' },
      // Undeclared by this class: no second declaration, so nothing to disagree.
      { where: 'nodes/3d/meshinstance3d/parser.ts:82', reader: 'intOr', key: 'gi_lightmap_scale', width: 'int32' },
    ];
    const verdicts = verdictsFor(reads, () => 'MeshInstance3D', synthetic);
    expect(verdicts.checked).toBe(2);
    expect(verdicts.disagreements).toEqual([
      'nodes/3d/meshinstance3d/parser.ts:80 parseOptionalInt(…layers) reads int32; declared uint32 by MeshInstance3D',
    ]);
  });

  it('holds a family helper to what every class declaring the key agrees on', () => {
    const reads: IntRead[] = [
      { where: 'r3f/internal/glb-scene-root/glbNodeOverrides.ts:103', reader: 'parseOptionalInt', key: 'layers', width: 'int32' },
    ];
    const verdicts = verdictsFor(reads, () => undefined, synthetic);
    expect(verdicts.disagreements).toEqual([
      'r3f/internal/glb-scene-root/glbNodeOverrides.ts:103 parseOptionalInt(…layers) reads int32; ' +
        'declared uint32 by all 2 classes declaring it',
    ]);
  });

  it('refuses to guess for a helper reading a key the classes declare differently', () => {
    const reads: IntRead[] = [
      { where: 'nodes/shared/masks.ts:12', reader: 'ruleInt', key: 'light_mask', width: 'int32' },
    ];
    const verdicts = verdictsFor(reads, () => undefined, synthetic);
    expect(verdicts.checked).toBe(0);
    expect(verdicts.disagreements).toEqual([]);
    expect(verdicts.unattributable).toEqual([
      "nodes/shared/masks.ts:12 ruleInt(…light_mask) sits in no class's directory, " +
        'and light_mask is declared int32 and uint32 across 2 classes',
    ]);
  });

  it('sweeps the whole tree, so a clean run is not an empty one', () => {
    expect(treeVerdicts.checked).toBeGreaterThan(80);
  });

  it('reads every int slot at the width its validator declares', () => {
    expect(treeVerdicts.disagreements).toEqual([]);
  });

  it('leaves no read of a split key unattributed', () => {
    expect(treeVerdicts.unattributable).toEqual([]);
  });
});
