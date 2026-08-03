#!/usr/bin/env node
/**
 * Scaffolds a new TSCN node-type vertical slice and wires its registration
 * imports into the three aggregation files, so adding a node type touches
 * no central file by hand.
 *
 * Usage:
 *   pnpm new:node <TypeName> <category-dir> [options]
 *
 *   <TypeName>      Godot type name, PascalCase (e.g. Marker3D)
 *   <category-dir>  directory under src/nodes/ (e.g. 3d, 2d, physics/3d, paths)
 *
 * Options:
 *   --base <node3d|node2d|node|control>  base slice to extend (default: node3d)
 *   --intent <draws|transform-only|pending>   REQUIRED — what the viewport does
 *   --chain <ParentType>         REQUIRED — Godot parent class, checked against ClassDB
 *   --linter                     generate strict validators + linter wiring
 *   --dry-run                    print the plan without writing anything
 *
 * `--intent` decides the slice's shape, its render registration and its sheet
 * status together, because those three must agree and `sheets.test.mjs` asserts
 * that they do:
 *
 *   draws           a full slice you are about to implement — own types/parser/
 *                   Component, plain render registration, status `unreviewed`.
 *   transform-only  ADR-0008: draws nothing BY DESIGN and is therefore finished.
 *                   Reuses the base parser and component, registers
 *                   `renderIntent: 'transform-only'`, status `linter-only`.
 *   pending         should draw, does not yet. Reuses the base parser, registers
 *                   NO component (GenericNodeFallback handles it), status
 *                   `unimplemented`.
 *
 * `--chain` no longer writes anything: NODE_BASE_TYPES is derived from the node
 * catalog, so a real Godot type already has its base. It is still required as a
 * spelling check — a name Godot does not know gets no base, and a type with no
 * base receives ZERO inherited validation with no error and no warning. Name
 * the Godot parent even when it is plain `Node`.
 *
 * Examples:
 *   pnpm new:node RayCast3D physics/3d --intent transform-only --chain Node3D --linter
 *   pnpm new:node ProgressBar 2d/ui --base control --intent pending --chain Range --linter
 *   pnpm new:node Decal 3d --intent draws --chain Node3D --linter
 *
 * The conformance guards (barrelCompleteness, reactFree, webExtensionSafe,
 * ruleCoverage) fail the suite if a generated slice is mis-wired.
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CORE_SRC = join(REPO_ROOT, 'packages/textscene-core/src');

/** What the viewport does with the type — see the header for what each implies. */
const INTENTS = ['draws', 'transform-only', 'pending'];

const NODE3D_PARSER_TEST_CASES = (typeName) => `  it('parses name, parent, and transform (happy path)', () => {
    const result = parse${typeName}(
      heading('${typeName}', { name: 'My${typeName}', parent: '.' }),
      { transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3, 4)' }
    );
    expect(result.name).toBe('My${typeName}');
    expect(result.parent).toBe('.');
    expect(result.transform?.origin).toEqual({ x: 2, y: 3, z: 4 });
  });

  it('falls back to identity transform on a malformed transform (error path)', () => {
    const result = parse${typeName}(
      heading('${typeName}', { name: 'Bad' }),
      { transform: 'Transform3D(not, valid)' }
    );
    expect(result.transform?.basis_x).toEqual({ x: 1, y: 0, z: 0 });
    expect(result.transform?.origin).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('handles missing optional attributes (edge case)', () => {
    const result = parse${typeName}({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.parent).toBeUndefined();
    expect(result.transform).toBeUndefined();
  });`;

const CONTROL_PARSER_TEST_CASES = (typeName) => `  it('parses name, parent, and the anchor/offset layout (happy path)', () => {
    const result = parse${typeName}(
      heading('${typeName}', { name: 'My${typeName}', parent: '.' }),
      { anchor_right: '1.0', offset_left: '8', offset_right: '-8' }
    );
    expect(result.name).toBe('My${typeName}');
    expect(result.parent).toBe('.');
    expect(result.anchorRight).toBe(1);
    expect(result.offsetLeft).toBe(8);
  });

  it('leaves a malformed offset undefined rather than guessing (error path)', () => {
    const result = parse${typeName}(
      heading('${typeName}', { name: 'Bad' }),
      { offset_left: 'not-a-number' }
    );
    expect(result.offsetLeft).toBeUndefined();
  });

  it('handles missing optional attributes (edge case)', () => {
    const result = parse${typeName}({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.parent).toBeUndefined();
    expect(result.anchorRight).toBeUndefined();
  });`;

const NODE2D_PARSER_TEST_CASES = (typeName) => `  it('parses name, parent, and the 2D transform (happy path)', () => {
    const result = parse${typeName}(
      heading('${typeName}', { name: 'My${typeName}', parent: '.' }),
      { position: 'Vector2(10, 20)', rotation: '0.5' }
    );
    expect(result.name).toBe('My${typeName}');
    expect(result.parent).toBe('.');
    expect(result.position).toEqual({ x: 10, y: 20 });
    expect(result.rotation).toBeCloseTo(0.5, 5);
  });

  it('falls back to the identity transform on a malformed transform (error path)', () => {
    const result = parse${typeName}(
      heading('${typeName}', { name: 'Bad' }),
      { transform: 'Transform2D(not, valid)' }
    );
    expect(result.position).toEqual({ x: 0, y: 0 });
    expect(result.scale).toEqual({ x: 1, y: 1 });
  });

  it('handles missing optional attributes (edge case)', () => {
    const result = parse${typeName}({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.parent).toBeUndefined();
    expect(result.position).toEqual({ x: 0, y: 0 });
  });`;

/**
 * The lenient-parser round trip, emitted into every registration test.
 *
 * A slice can register a parser and still be invisible to `TscnParser` if the
 * aggregation import is missing, in which case `parseNodeWithRegistry` quietly
 * falls back to Node and logs `Unsupported node type`. Asserting the absence of
 * that warning is the only check that catches it. 31 slices hand-wrote this
 * block before the template carried it, so it is generated now rather than
 * left to whoever remembers.
 */
const LENIENT_TREE_TEST_CASE = (typeName, rootType) =>
  `  it('lands in the lenient parser tree with its type preserved and no fallback warning', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    const scene = new TscnParser().parse(
      '[gd_scene format=3]\\n\\n[node name="Root" type="${rootType}"]\\n\\n' +
        '[node name="My${typeName}" type="${typeName}" parent="."]\\n'
    );

    const node = scene.nodes[0]?.children[0];
    expect(node?.type).toBe('${typeName}');
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('Unsupported node type'));

    warnSpy.mockRestore();
  });`;

/**
 * `hasLinterParser` drives the side-effect import a generated `linterParser.ts`
 * puts at the top. Without it the module registers only its OWN keys, so a test
 * that imports `./linterParser` directly sees `findValidator` return null for
 * every inherited one — the exact breakage `viewport/subviewport` had to be
 * repaired for by hand. 18 hand-written slices already carry this import.
 */
const BASES = {
  node3d: {
    workspaceFlag: '',
    dir: 'base/node3d',
    parser: 'parseNode3D',
    component: 'Node3D',
    propsType: 'Node3DProperties',
    parserTestCases: NODE3D_PARSER_TEST_CASES,
    hasLinterParser: true,
  },
  node2d: {
    dir: 'base/node2d',
    parser: 'parseNode2D',
    component: 'Node2D',
    propsType: 'Node2DProperties',
    // Node2D world content renders in the 2D canvas only; without this the
    // workspace dispatcher puts it in the 3D viewport (canvasItemRegistry.guard).
    workspaceFlag: 'canvasItem: true,',
    parserTestCases: NODE2D_PARSER_TEST_CASES,
    hasLinterParser: true,
  },
  control: {
    workspaceFlag: '',
    dir: '2d/ui/control',
    parser: 'parseControl',
    component: 'Control',
    propsType: 'ControlProperties',
    // Control has no `transform`: layout comes from anchors/offsets, and the
    // whole set is validated on `Control` itself and inherited via the chain.
    // A leaf declares only its OWN members.
    parserTestCases: CONTROL_PARSER_TEST_CASES,
    hasLinterParser: true,
  },
  node: {
    dir: 'node',
    parser: 'parseNode',
    component: 'Node',
    propsType: 'NodeProperties',
    // Neither 2D nor 3D: passes through both workspaces so its children render
    // wherever they belong.
    workspaceFlag: 'container: true,',
    parserTestCases: NODE3D_PARSER_TEST_CASES,
    // `nodes/node/` registers the ten process/threading/editor keys every type
    // inherits, so a leaf must import it like any other base.
    hasLinterParser: true,
  },
};

function fail(message) {
  console.error(`[new-node-slice] ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const positional = [];
  const opts = { base: 'node3d', intent: '', chain: '', linter: false, dryRun: false, tier: false, rule: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') opts.base = argv[++i];
    else if (a === '--intent') opts.intent = argv[++i];
    else if (a === '--chain') opts.chain = argv[++i];
    else if (a === '--transform-only') {
      // Replaced by `--intent transform-only`, which also settles the render
      // registration and the sheet status. Kept as a hard error rather than an
      // alias so a stale invocation cannot quietly skip that classification.
      fail('--transform-only is gone: pass `--intent transform-only` instead.');
    } else if (a === '--linter') opts.linter = true;
    else if (a === '--tier') opts.tier = true;
    else if (a === '--rule') opts.rule = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a.startsWith('--')) fail(`unknown option: ${a}`);
    else positional.push(a);
  }
  if (positional.length !== 2) {
    fail(
      'usage: pnpm new:node <TypeName> <category-dir> --intent <draws|transform-only|pending> ' +
        '--chain <ParentType> [--base node3d|node2d|node|control] [--linter] [--dry-run]\n' +
        '   or: pnpm new:node <AbstractType> <category-dir> --tier [--rule] [--dry-run]'
    );
  }
  const [typeName, category] = positional;
  if (!/^[A-Z][A-Za-z0-9]*$/.test(typeName)) fail(`TypeName must be PascalCase, got: ${typeName}`);
  if (!/^[a-z0-9/]+$/.test(category)) fail(`category-dir must be lowercase path segments, got: ${category}`);

  if (opts.tier) {
    // A tier is a validator set for an abstract Godot class: no parser, no
    // component, no fixture, no sheet, because the class cannot appear in a
    // .tscn. So --intent, --base and --chain are all meaningless here.
    for (const [flag, value] of [['--intent', opts.intent], ['--chain', opts.chain]]) {
      if (value) fail(`${flag} does not apply to --tier: an abstract class has no slice shape and no leaf chain.`);
    }
    if (opts.linter) fail('--linter does not apply to --tier: a tier is validators by definition.');
    return { typeName, category, ...opts };
  }
  if (opts.rule) fail('--rule only applies with --tier.');

  if (!BASES[opts.base]) fail(`--base must be one of ${Object.keys(BASES).join('|')}, got: ${opts.base}`);
  if (!INTENTS.includes(opts.intent)) {
    fail(`--intent is required and must be one of ${INTENTS.join('|')}, got: ${opts.intent || '(none)'}`);
  }
  if (!/^[A-Z][A-Za-z0-9]*$/.test(opts.chain)) {
    fail(
      `--chain is required: name the Godot parent class (e.g. --chain Node3D). ` +
        `Without it the type is absent from NODE_BASE_TYPES and silently receives ` +
        `no inherited validation. Got: ${opts.chain || '(none)'}`
    );
  }
  if (opts.chain === typeName) fail('--chain must be the PARENT class, not the type itself');
  if (opts.base === 'control' && opts.intent !== 'pending') {
    fail(
      `--base control supports only --intent pending.\n` +
        `A Control that RENDERS belongs to the 2D DOM overlay (ADR-0003): it registers ` +
        `into controlComponentRegistry, wires r3f/controls/index.ts, and must join ` +
        `TWO_D_UI_TYPES in r3f/controls/has2DUIContent.ts, whose driftguard asserts exact ` +
        `set equality. This scaffold emits none of that — it would register a DOM ` +
        `component into the THREE registry and mount a <div> into the R3F reconciler. ` +
        `Scaffold it as pending, or teach BASES to own its registry and barrel first.`
    );
  }
  return { typeName, category, ...opts };
}

/**
 * Path from `sliceDir` to the linterParser that registers `parentType`.
 *
 * A generated `linterParser.ts` side-effect-imports its parent's so that a test
 * importing only `./linterParser` sees the inherited keys through
 * `findValidator`. The parent is a Godot class, not the `--base` flag: chaining
 * to `base/node3d` when the real parent is `RigidBody3D` skips every validator
 * between them, which is invisible until someone writes such a test. Resolved
 * by scanning for the `registerAll('<Parent>'` that owns the type, so abstract
 * tiers (`physics/shared` for CollisionObject3D) resolve like any other.
 *
 * Falls back to the `--base` slice when the parent registers nothing yet, which
 * is correct: there is no tier to reach.
 */
function parentLinterParser(typeName, parentType, sliceDir, fallback) {
  /** Directory of the linterParser that calls `registerAll('<type>')`, if one does. */
  const ownerOf = (type) => {
    const needle = `registerAll('${type}'`;
    const found = [];
    (function walk(dir) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name === 'linterParser.ts' && readFileSync(full, 'utf8').includes(needle)) {
          found.push(dirname(full));
        }
      }
    })(join(CORE_SRC, 'nodes'));
    return found.length === 1 ? found[0] : undefined;
  };

  // Walk up Godot's chain to the NEAREST ancestor that registers something.
  // `PhysicsBody3D` and `Button` bind nothing and own no slice, so stopping at
  // the immediate parent would skip the tier above them.
  const catalog = JSON.parse(readFileSync(join(REPO_ROOT, 'scripts/compare-docs/node-catalog.json'), 'utf8'));
  const chain = catalog.nodes.find((n) => n.name === typeName)?.chain ?? [parentType];
  for (const ancestor of chain) {
    const dir = ownerOf(ancestor);
    if (!dir) continue;
    const rel = relative(sliceDir, dir).replaceAll('\\', '/');
    return `${rel.startsWith('.') ? rel : `./${rel}`}/linterParser.js`;
  }
  return fallback;
}

/**
 * The parse function a `transform-only` / `pending` slice should reuse.
 *
 * The sibling of `parentLinterParser`, and needed for the same reason: `--base`
 * is a coarse flag (node3d/node2d/node/control) while `--chain` is the real
 * Godot parent. They diverge whenever an ancestor has its OWN typed parser, and
 * the split is silent - `SoftBody3D` registered `parseNode3D` while its linter
 * side inherited every MeshInstance3D validator, so `mesh`, `skin` and the
 * material overrides were validated and then discarded, leaving the inspector
 * blank for exactly the properties the sheet advertises.
 *
 * Walks the catalog ancestry to the nearest ancestor that owns a `parser.ts`,
 * falling back to the `--base` slice when none does.
 *
 * @returns `{ importPath, fn }` relative to the slice directory.
 */
function parentParser(typeName, sliceDir, fallback) {
  const catalog = JSON.parse(readFileSync(join(REPO_ROOT, 'scripts/compare-docs/node-catalog.json'), 'utf8'));
  const chain = catalog.nodes.find((n) => n.name === typeName)?.chain ?? [];
  for (const ancestor of chain) {
    const owner = ownerOfParser(ancestor);
    if (!owner) continue;
    const rel = relative(sliceDir, owner).replaceAll('\\', '/');
    return { importPath: `${rel.startsWith('.') ? rel : `./${rel}`}/parser`, fn: `parse${ancestor}` };
  }
  return fallback;
}

/** Directory of the slice whose parser.ts exports `parse<Type>`, if one does. */
function ownerOfParser(type) {
  const needle = `export function parse${type}(`;
  const found = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'parser.ts' && readFileSync(full, 'utf8').includes(needle)) {
        found.push(dirname(full));
      }
    }
  })(join(CORE_SRC, 'nodes'));
  return found.length === 1 ? found[0] : undefined;
}

/**
 * Check a `--tier` name against ClassDB, and report who inherits from it.
 *
 * The opposite check from `checkChain`: an abstract class is by definition NOT
 * instantiable, so it is absent from the catalog's node list and present only
 * inside other types' `chain` arrays. A tier keyed on a name Godot never had
 * registers validators nothing can inherit, and nothing fails, so the spelling
 * check matters more here than for a leaf.
 *
 * @returns the concrete catalogued types that would inherit the tier.
 */
function checkTier(typeName) {
  const catalog = JSON.parse(readFileSync(join(REPO_ROOT, 'scripts/compare-docs/node-catalog.json'), 'utf8'));
  if (catalog.nodes.some((n) => n.name === typeName)) {
    fail(
      `${typeName} is instantiable, so it is a node type, not an abstract tier. ` +
        `Scaffold it as an ordinary slice: drop --tier and pass --intent and --chain.`
    );
  }
  const heirs = catalog.nodes.filter((n) => (n.chain ?? []).includes(typeName)).map((n) => n.name);
  if (heirs.length === 0) {
    fail(
      `No catalogued type descends from ${typeName}, so a tier keyed on it would ` +
        `register validators nothing inherits. Check the spelling against ClassDB.`
    );
  }
  return heirs;
}

/**
 * Check `--chain` against Godot's own answer in the node catalog.
 *
 * `NODE_BASE_TYPES` is derived from that catalog, so nothing needs writing —
 * the entry for a real Godot type is already there. What `--chain` still buys
 * is the one failure the derivation cannot catch: a type name that is not a
 * Godot type at all. A misspelled `Raycast3D` gets no catalog entry, so it gets
 * no base, so the validator walk terminates instantly and the slice is silently
 * unvalidated. Naming the expected parent turns that into an error here rather
 * than a quiet gap discovered waves later.
 */
function checkChain(typeName, parent) {
  const catalog = JSON.parse(readFileSync(join(REPO_ROOT, 'scripts/compare-docs/node-catalog.json'), 'utf8'));
  const entry = catalog.nodes.find((n) => n.name === typeName);
  if (!entry) {
    fail(
      `${typeName} is not in scripts/compare-docs/node-catalog.json, so NODE_BASE_TYPES ` +
        `has no base for it and every inherited validator would silently skip the type. ` +
        `Check the spelling, or add it to UNCATALOGUED in linter/nodeBaseTypes.ts with a reason.`
    );
  }
  const actual = entry.chain?.[0];
  if (actual !== parent) {
    fail(
      `--chain ${parent} disagrees with Godot: ${typeName} derives from ${actual}. ` +
        `The base-walk uses the catalog, so pass --chain ${actual}.`
    );
  }
  return `${typeName} → ${parent} (derived, already in linter/nodeBaseTypes.generated.ts)`;
}

/** Marker3D → marker-3d, AudioStreamPlayer2D → audio-stream-player-2d */
function kebab(typeName) {
  const tokens = typeName.match(/[A-Z]+(?![a-z])|[A-Z][a-z]+|\d+[A-Za-z]?/g) ?? [typeName];
  return tokens.join('-').toLowerCase();
}

/**
 * Insert an import line after the last import sharing the category prefix
 * (preserves the category grouping in the aggregation files); falls back
 * to after the last import line.
 */
function wireImport(filePath, importLine, categoryNeedle) {
  const src = readFileSync(filePath, 'utf8');
  if (src.includes(importLine)) return { filePath, action: 'already wired' };
  const lines = src.split('\n');
  let insertAt = -1;
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import\s+'/.test(lines[i])) {
      lastImport = i;
      if (lines[i].includes(categoryNeedle)) insertAt = i;
    }
  }
  const at = (insertAt >= 0 ? insertAt : lastImport) + 1;
  if (at === 0) fail(`no import lines found in ${filePath}`);
  lines.splice(at, 0, importLine);
  return { filePath, action: `insert at line ${at + 1}`, content: lines.join('\n') };
}

/**
 * Scaffold a shared validator tier for an abstract Godot class.
 *
 * A tier is not a slice: the class cannot be instantiated, so there is no
 * parser, no component, no fixture and no comparison sheet. It exists because
 * `NODE_BASE_TYPES` carries every hop of Godot's ancestry, so validators
 * registered on an intermediate reach its subclasses.
 *
 * `--rule` decides the wiring, and the distinction is the one the guards
 * already enforce: a tier carrying only validators is pulled in by whichever
 * leaf imports its linterParser, so it needs no barrel entry. A tier carrying a
 * RULE has no such consumer, so it needs `index.linter.ts` and a line in
 * `linter/index.ts`, or `ruleCoverage` reports the rule as declared-but-never-
 * registered.
 */
function scaffoldTier({ typeName, category, rule, dryRun }) {
  const heirs = checkTier(typeName);

  // `<category>/shared` is the home when the category has exactly one tier, as
  // 3d/lights and canvasitem do. It does not generalise: 2d/ui/shared already
  // holds parser helpers for four different bases, so a `linterParser.ts`
  // dropped in there would speak for one of them with nothing saying which, and
  // the next tier in the category would have nowhere to go. When the directory
  // is taken, the tier gets one named after the class instead — unambiguous,
  // and as many tiers per category as Godot has abstract classes.
  const sharedRel = `nodes/${category}/shared`;
  const taken = existsSync(join(CORE_SRC, sharedRel));
  const sliceRel = taken ? `nodes/${category}/${typeName.toLowerCase()}` : sharedRel;
  const sliceDir = join(CORE_SRC, sliceRel);
  if (!dryRun && existsSync(sliceDir)) fail(`tier already exists: ${sliceDir}`);
  const toSrc = '../'.repeat(sliceRel.split('/').length);

  const files = new Map();
  files.set(
    'linterParser.ts',
    `/**
 * Validators shared by every ${typeName}-derived node.
 *
 * Registered under the abstract key '${typeName}', which Godot cannot
 * instantiate, so it appears in no .tscn and owns no slice. It reaches its
 * ${heirs.length} subclass${heirs.length === 1 ? '' : 'es'} through the
 * NODE_BASE_TYPES base-walk.
 *
 * Declare only ${typeName}'s OWN members: the ones doc/classes/${typeName}.xml
 * lists without an \`overrides=\` attribute, cross-checked against ADD_PROPERTY
 * in the .cpp. Quote the governing source line beside every non-obvious bound.
 */

import { validatorRegistry } from '${toSrc}linter/ValidatorRegistry.js';

validatorRegistry.registerAll('${typeName}', {});
`
  );
  files.set(
    'linterParser.test.ts',
    `/**
 * The ${typeName} set must reach its subclasses, which is the whole point of
 * the tier. Assert through \`findValidator\` on a real leaf, not just on the
 * abstract key: a tier that registers but is never imported registers nothing.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '${toSrc}linter/ValidatorRegistry.js';
import './linterParser.js';

/** Fill from doc/classes/${typeName}.xml. Red until you do, deliberately. */
const KEYS: string[] = [];
const LEAVES = ${JSON.stringify(heirs.slice(0, 3))} as const;

describe('${typeName} shared validators', () => {
  it('registers exactly what ${typeName} binds', () => {
    // Emptiness check first: an empty KEYS against an empty registerAll would
    // otherwise pass vacuously and ship a tier that validates nothing.
    expect(validatorRegistry.getOwnKeys('${typeName}')).not.toEqual([]);
    expect(validatorRegistry.getOwnKeys('${typeName}').sort()).toEqual([...KEYS].sort());
  });

  it.each(LEAVES)('delivers every key to %s through the base-walk', (nodeType) => {
    const missing = KEYS.filter((key) => !validatorRegistry.findValidator(nodeType, key));
    expect(missing).toEqual([]);
  });
});
`
  );
  if (rule) {
    files.set(
      'linter.ts',
      `/**
 * Semantic rule for the whole ${typeName} family.
 *
 * One registration reaching every descendant through
 * \`applicableNodeTypeMatcher\`, because RuleRegistry matches
 * \`applicableNodeTypes\` by exact name and would otherwise never reach a
 * subclass. Mirror Godot's own \`${typeName}::get_configuration_warnings\`;
 * skip any case that needs resolving a NodePath's target TYPE, which crosses
 * into instanced sub-scenes this linter cannot see.
 */

import type { Diagnostic, LintRule, RuleContext } from '${toSrc}linter/types.js';
import { ruleRegistry } from '${toSrc}linter/RuleRegistry.js';
import { descendsFrom } from '${toSrc}linter/nodeBaseTypes.js';

function check${typeName}(context: RuleContext): Diagnostic[] {
  // No applicability check here: RuleRegistry has already filtered by the
  // matcher below, so re-asserting it states the same fact twice and the two
  // can drift.
  const { node } = context;
  void node;
  return [];
}

const ${typeName[0].toLowerCase() + typeName.slice(1)}ValidationRule: LintRule = {
  meta: {
    name: 'valid-${typeName.toLowerCase()}',
    description: 'TBD',
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, '${typeName}'),
    emits: [],
  },
  check: check${typeName},
};

ruleRegistry.register(${typeName[0].toLowerCase() + typeName.slice(1)}ValidationRule);

export { ${typeName[0].toLowerCase() + typeName.slice(1)}ValidationRule };
`
    );
    files.set(
      'linter.test.ts',
      `/**
 * The ${typeName} family rule, asserted once for every subclass it reaches.
 */

import { describe, expect, it } from 'vitest';
import { ruleRegistry } from '${toSrc}linter/RuleRegistry.js';
import { ${typeName[0].toLowerCase() + typeName.slice(1)}ValidationRule } from './linter.js';
import '${toSrc}linter/index.js';

describe('${typeName} family rule', () => {
  it('registers one rule for the family', () => {
    expect(ruleRegistry.getRules().find((r) => r.meta.name === 'valid-${typeName.toLowerCase()}')).toBe(
      ${typeName[0].toLowerCase() + typeName.slice(1)}ValidationRule
    );
  });
});
`
    );
    files.set(
      'index.linter.ts',
      `/**
 * ${typeName} tier registration: the shared validators and the family rule.
 * Barrel-imported because a rule has no leaf to pull it in.
 */

import './linterParser.js';
import './linter.js';
`
    );
  }

  const wirings = rule
    ? [wireImport(join(CORE_SRC, 'linter/index.ts'), `import '../${sliceRel}/index.linter.js';`, `'../nodes/${category}/`)]
    : [];

  console.log(`[new-node-slice] ${typeName} tier -> ${sliceRel}${rule ? ' (with family rule)' : ' (validators only)'}`);
  for (const name of files.keys()) console.log(`  create  ${sliceRel}/${name}`);
  for (const w of wirings) console.log(`  wire    ${w.filePath.slice(REPO_ROOT.length + 1)} (${w.action})`);
  console.log(`  heirs   ${heirs.length}: ${heirs.slice(0, 6).join(', ')}${heirs.length > 6 ? ', ...' : ''}`);
  if (!rule) {
    console.log('  note    validators-only tier: no barrel entry, each leaf imports ./linterParser.js');
  }

  if (dryRun) {
    console.log('[new-node-slice] dry run - nothing written.');
    return;
  }
  mkdirSync(sliceDir, { recursive: true });
  for (const [name, content] of files) writeFileSync(join(sliceDir, name), content);
  for (const w of wirings) if (w.content) writeFileSync(w.filePath, w.content);
  console.log(`[new-node-slice] done. Fill ${sliceRel}/linterParser.ts from doc/classes/${typeName}.xml, and list the keys in KEYS in its test.`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.tier) return scaffoldTier(args);
  const { typeName, category, base: baseKey, intent, chain, linter, dryRun } = args;
  // `draws` is the only intent that gets its own types/parser/Component; the
  // other two reuse the base parser, so the render half is deferred to whoever
  // implements it (decision: property knowledge lives in linterParser.ts).
  // True for BOTH `transform-only` and `pending` — it says "reuses the base
  // parser", not "draws nothing", which is why it is not named for either.
  const reusesBaseParser = intent !== 'draws';
  const base = BASES[baseKey];
  const lower = typeName.toLowerCase();
  const camel = typeName[0].toLowerCase() + typeName.slice(1);
  const kebabName = kebab(typeName);

  const sliceRel = `nodes/${category}/${lower}`;
  const sliceDir = join(CORE_SRC, sliceRel);
  // A dry run writes nothing, so an already-scaffolded slice is no obstacle to
  // printing its plan — and the contract tests below name real Godot types, all
  // of which get scaffolded eventually.
  if (!dryRun && existsSync(sliceDir)) fail(`slice already exists: ${sliceDir}`);

  const catDepth = category.split('/').length;
  const toSrc = '../'.repeat(catDepth + 2); // slice dir → src/
  const toBase = '../'.repeat(catDepth + 1) + base.dir; // slice dir → base slice

  // Reuse the nearest ancestor's typed parser, not the --base flag's: they
  // differ whenever a Godot ancestor owns a parser.ts, and taking the flag
  // silently discards every property that ancestor reads.
  const reusedParser = reusesBaseParser
    ? parentParser(typeName, sliceDir, { importPath: `${toBase}/parser`, fn: base.parser })
    : { importPath: `${toBase}/parser`, fn: base.parser };

  const files = new Map(); // relative-to-slice name → content

  if (reusesBaseParser) {
    files.set(
      'index.ts',
      `/**
 * ${typeName} registration — parser.
 *
 * Reuses the ${base.component} parse; property knowledge lives in linterParser.ts${
   intent === 'transform-only'
     ? `.
 * Draws nothing by design (ADR-0008), so index.r3f.ts registers ${base.component}
 * and its children still land in the right transform space.`
     : `.
 * Not rendered yet, so it registers NO component: the dispatcher falls back to
 * GenericNodeFallback and the tree keeps reporting it as not implemented.`
 }
 */

import { nodeRegistry, type NodeTypeRegistration } from '${toSrc}core/NodeRegistry';
import { ${reusedParser.fn} } from '${reusedParser.importPath}';

const ${camel}Registration: NodeTypeRegistration = {
  typeName: '${typeName}',
  parser: ${reusedParser.fn},
};

nodeRegistry.register(${camel}Registration);

export { ${camel}Registration };
`
    );
    if (intent === 'transform-only') {
      files.set(
        'index.r3f.ts',
        `/**
 * ${typeName} draws nothing of its own (ADR-0008) — reuse the ${base.component}
 * component so its children still land in the right transform space.
 */

import { nodeComponentRegistry } from '${toSrc}r3f/NodeComponentRegistry';
import { ${base.component} } from '${toBase}/Component';

nodeComponentRegistry.register({
  typeName: '${typeName}',
  Component: ${base.component},
${base.workspaceFlag ? `  ${base.workspaceFlag}\n` : ''}  renderIntent: 'transform-only',
});
`
      );
    }
    files.set(
      `${lower}.test.ts`,
      intent === 'transform-only'
        ? `/**
 * ${typeName} registration — it is parsed, and it draws nothing on purpose
 * (ADR-0008) rather than for want of an implementation.
 */

import { describe, expect, it, vi } from 'vitest';
import { nodeRegistry } from '${toSrc}core/NodeRegistry';
import { nodeComponentRegistry } from '${toSrc}r3f/NodeComponentRegistry';
import { TscnParser } from '${toSrc}parser/TscnParser';
import * as logger from '${toSrc}logger';
import { ${reusedParser.fn} } from '${reusedParser.importPath}';
import { ${base.component} } from '${toBase}/Component';
import './index';
import './index.r3f';

describe('${typeName} registration', () => {
  it('registers the ${base.component} base parser', () => {
    const registration = nodeRegistry.getRegistration('${typeName}');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(${base.parser});
  });

  it('reuses the ${base.component} component so children keep their transform space', () => {
    expect(nodeComponentRegistry.get('${typeName}')).toBe(${base.component});
  });

  it('declares drawing nothing, so the sheet may claim linter-only', () => {
    expect(nodeComponentRegistry.isTransformOnly('${typeName}')).toBe(true);
  });

${LENIENT_TREE_TEST_CASE(typeName, base.component)}
});
`
        : `/**
 * ${typeName} registration — parsed and validated, not yet rendered.
 *
 * Registering NO component is the point: the dispatcher falls back to
 * GenericNodeFallback, and \`rendersOwnVisual\` reports 'not-implemented' so the
 * tree and inspector keep saying so until someone draws it.
 */

import { describe, expect, it, vi } from 'vitest';
import { nodeRegistry } from '${toSrc}core/NodeRegistry';
import { nodeComponentRegistry } from '${toSrc}r3f/NodeComponentRegistry';
import { TscnParser } from '${toSrc}parser/TscnParser';
import * as logger from '${toSrc}logger';
import { ${reusedParser.fn} } from '${reusedParser.importPath}';
import './index';

describe('${typeName} registration', () => {
  it('registers the ${base.component} base parser', () => {
    const registration = nodeRegistry.getRegistration('${typeName}');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(${base.parser});
  });

  it('registers no render component, so it still reads as not implemented', () => {
    expect(nodeComponentRegistry.get('${typeName}')).toBeUndefined();
  });

${LENIENT_TREE_TEST_CASE(typeName, base.component)}
});
`
    );
  } else {
    files.set(
      'types.ts',
      `/**
 * ${typeName}-specific type definitions.
 * Convert the alias to an interface extending ${base.propsType} when the
 * node grows its own parsed properties.
 */

import type { ${base.propsType} } from '${toBase}/types';

export type ${typeName}Properties = ${base.propsType};
`
    );
    files.set(
      'parser.ts',
      `/**
 * ${typeName} parser — extends the ${base.component} base parse.
 */

import type { ParsedHeading } from '${toSrc}parser/utils';
import { ${reusedParser.fn} } from '${reusedParser.importPath}';
import type { ${typeName}Properties } from './types';

export function parse${typeName}(
  heading: ParsedHeading,
  properties: Record<string, string>
): ${typeName}Properties {
  const baseProperties = ${base.parser}(heading, properties);
  return {
    ...baseProperties,
  };
}
`
    );
    files.set(
      'parser.test.ts',
      `import { describe, expect, it } from 'vitest';
import { heading } from '${toSrc}parser/testing/parserKit';
import { parse${typeName} } from './parser';

describe('parse${typeName}', () => {
${base.parserTestCases(typeName)}
});
`
    );
    files.set(
      'Component.tsx',
      `/** ${typeName} render component — transform group wrapping children. */

import type { NodeComponentProps } from '${toSrc}r3f/NodeComponentRegistry';
import { ${base.component} } from '${toBase}/Component';

export function ${typeName}({ node, children }: NodeComponentProps) {
  return <${base.component} node={node}>{children}</${base.component}>;
}
`
    );
    files.set(
      'Component.test.tsx',
      `import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '${toSrc}parser/types';
import { parse${typeName} } from './parser';
import { ${typeName} } from './Component';

const baseNode: TscnNode = {
  name: 'My${typeName}',
  type: '${typeName}',
  children: [],
  properties: parse${typeName}(
    { type: 'node', attributes: { type: '${typeName}', name: 'My${typeName}' } },
    {}
  ),
};

describe('<${typeName}>', () => {
  it('renders a group', async () => {
    const renderer = await ReactThreeTestRenderer.create(<${typeName} node={baseNode} />);
    expect(renderer.scene.findAllByType('Group').length).toBeGreaterThan(0);
  });

  it('renders children inside the group', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <${typeName} node={baseNode}>
        <mesh name="child">
          <boxGeometry />
          <meshBasicMaterial />
        </mesh>
      </${typeName}>
    );
    expect(renderer.scene.findByProps({ name: 'child' })).toBeDefined();
  });
});
`
    );
    files.set(
      'index.ts',
      `/**
 * ${typeName} registration — parser.
 */

import { nodeRegistry, type NodeTypeRegistration } from '${toSrc}core/NodeRegistry';
import { parse${typeName} } from './parser';

const ${camel}Registration: NodeTypeRegistration = {
  typeName: '${typeName}',
  parser: parse${typeName},
};

nodeRegistry.register(${camel}Registration);

export { ${camel}Registration };
`
    );
    files.set(
      'index.r3f.ts',
      `import { nodeComponentRegistry } from '${toSrc}r3f/NodeComponentRegistry';
import { ${typeName} } from './Component';

nodeComponentRegistry.register({ typeName: '${typeName}', Component: ${typeName} });

export { ${typeName} };
`
    );
  }

  if (linter) {
    files.set(
      'linterParser.ts',
      `/**
 * ${typeName} strict validators for linting.
 *
 * Declare only ${typeName}'s OWN members — the ones doc/classes/${typeName}.xml
 * lists without an \`overrides=\` attribute. Everything from ${chain} up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

${base.hasLinterParser ? `import '${parentLinterParser(typeName, chain, sliceDir, `${toBase}/linterParser.js`)}';\n` : ''}import { validatorRegistry } from '${toSrc}linter/ValidatorRegistry.js';

validatorRegistry.registerAll('${typeName}', {});
`
    );
    files.set(
      'index.linter.ts',
      `/**
 * ${lower} linter registration - imports linter components to trigger self-registration.
 */

import './linterParser.js';
`
    );
    files.set(
      'linterParser.test.ts',
      `/**
 * ${typeName} strict validators — format and range checks.
 *
 * Asserted through \`validatorRegistry\` rather than by linting a \`.tscn\`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through \`Linter\`.
 *
 * Grow this into one case per property — happy, malformed, and any bound — and
 * quote the governing Godot source line beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '${toSrc}linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('${typeName}', property);
  expect(validator, \`no validator registered for ${typeName}.\${property}\`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('${typeName} strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('${typeName}')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('${typeName}')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });
});
`
    );
  }

  const fixtureName = `unit-${kebabName}.tscn`;
  const fixturePath = join(REPO_ROOT, 'scenes/fixtures', fixtureName);
  const FIXTURES = {
    // A Control is laid out by anchors and offsets under a Control parent; a
    // Transform3D on one is not a thing Godot would ever write.
    control: `[gd_scene format=3]

[node name="Root" type="Control"]
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0

[node name="My${typeName}" type="${typeName}" parent="."]
layout_mode = 1
offset_left = 8.0
offset_top = 8.0
offset_right = 108.0
offset_bottom = 40.0
`,
    node2d: `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="My${typeName}" type="${typeName}" parent="."]
position = Vector2(10, 20)
`,
    node3d: `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="My${typeName}" type="${typeName}" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)
`,
    // A non-spatial node carries no transform at all.
    node: `[gd_scene format=3]

[node name="Root" type="Node"]

[node name="My${typeName}" type="${typeName}" parent="."]
`,
  };
  const fixtureContent = FIXTURES[baseKey];

  const wirings = [
    wireImport(
      join(CORE_SRC, 'parser/TscnParser.ts'),
      `import '../${sliceRel}/index.js';`,
      `'../nodes/${category}/`
    ),
  ];
  // A `pending` slice registers no component at all, so there is nothing to wire
  // into the render barrel — that absence is what keeps the "Not implemented"
  // badge honest.
  if (intent !== 'pending') {
    wirings.push(
      wireImport(
        join(CORE_SRC, 'r3f/nodes/index.ts'),
        `import '../../${sliceRel}/index.r3f';`,
        `'../../nodes/${category}/`
      )
    );
  }
  if (linter) {
    wirings.push(
      wireImport(
        join(CORE_SRC, 'linter/index.ts'),
        `import '../${sliceRel}/index.linter.js';`,
        `'../nodes/${category}/`
      )
    );
  }

  const chainNote = checkChain(typeName, chain);

  // The comparison sheet is slice content (SHEET-STANDARD.md). `image:` ships
  // commented out: a declared-but-uncaptured basename fails build-gallery (and
  // so the web build), while recapture only collects sheets that DO declare one.
  // So the order is: uncomment the line, then `pnpm recapture --only <basename>`.
  // Until then the gallery shows its "not captured yet" placeholder.
  //
  // `category` is a best guess — 2D/3D from the type suffix, Other for a
  // non-visual node; the corpus is genuinely mixed here (AnimationPlayer is 3D,
  // Timer is Other), so check the nav divider it lands under.
  const imageBasename = fixtureName.replace(/\.tscn$/, '');
  const sheetCategory = /2D$/.test(typeName)
    ? '2D'
    : /3D$/.test(typeName)
      ? '3D'
      : baseKey === 'node2d' || baseKey === 'control'
        ? '2D'
        : baseKey === 'node'
          ? 'Other'
          : '3D';

  // Status and `visual:` follow from the intent, and `sheets.test.mjs` asserts
  // the status against the render registration in both directions — so these
  // cannot be hand-edited apart from the slice without failing.
  const sheetStatus = { draws: 'unreviewed', 'transform-only': 'linter-only', pending: 'unimplemented' }[
    intent
  ];
  // A node that draws nothing has no image pair worth showing. A `pending` node
  // has none YET, and will once it renders, so it does not claim `visual: false`.
  const visualLine = intent === 'transform-only' ? 'visual: false\n' : '';
  const rendersAs = {
    draws: 'TBD — one short noun phrase',
    'transform-only': 'nothing (a transform-only group)',
    pending: 'nothing yet — not implemented',
  }[intent];
  const sheetIntro = {
    draws: 'One or two sentences: what the node is, and what the previewer draws for it.',
    'transform-only':
      'This node draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008): its children still show, and that absence is the whole story.',
    pending:
      'The previewer parses and validates this node but does not draw it yet, so it renders as an invisible transform-only fallback and its children still show.',
  }[intent];
  files.set(
    'comparison.md',
    `---
type: ${typeName}
category: ${sheetCategory}
status: ${sheetStatus}
fixture: ${fixtureName}
# image: ${imageBasename}
${visualLine}renders_as: ${rendersAs}
---

# ${typeName}

${sheetIntro}

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |

## Divergences

Not captured yet.

## Linting

<!-- lint:begin ${typeName} -->
<!-- lint:end -->

${typeName} registers no validators or semantic rules of its own yet, so the strict
and lenient parsers agree on every property: whatever \`parser.ts\` reads it reads
without substitution. Replace this once \`linterParser.ts\` has validators, naming
the property and the value the lenient parser falls back to.
`
  );

  console.log(`[new-node-slice] ${typeName} → ${sliceRel} (base: ${baseKey}, intent: ${intent}${linter ? ', linter' : ''})`);
  for (const name of files.keys()) console.log(`  create  ${sliceRel}/${name}`);
  console.log(`  create  scenes/fixtures/${fixtureName}`);
  for (const w of wirings) console.log(`  wire    ${w.filePath.slice(REPO_ROOT.length + 1)} (${w.action})`);
  console.log(`  chain   ${chainNote}`);
  console.log(`  parser  ${reusedParser.fn} from ${reusedParser.importPath}`);
  if (linter) {
    console.log(
      `  inherit ${parentLinterParser(typeName, chain, sliceDir, `${toBase}/linterParser.js`)}`
    );
  }

  if (dryRun) {
    console.log('[new-node-slice] dry run — nothing written.');
    return;
  }

  mkdirSync(sliceDir, { recursive: true });
  for (const [name, content] of files) writeFileSync(join(sliceDir, name), content);
  if (existsSync(fixturePath)) fail(`fixture already exists: ${fixturePath}`);
  writeFileSync(fixturePath, fixtureContent);
  for (const w of wirings) {
    if (w.content) writeFileSync(w.filePath, w.content);
  }

  execSync('pnpm generate:fixtures', { cwd: REPO_ROOT, stdio: 'inherit' });

  console.log(`[new-node-slice] done. Next steps:
  1. Write ${sliceRel}/linterParser.ts from the Godot source: every own member of
     doc/classes/${typeName}.xml, skipping any tagged \`overrides=\` (a default
     override, already validated on the parent) and any ADD_PROPERTY flagged
     PROPERTY_USAGE_NONE (never written to a .tscn). Quote the source line beside
     each numeric bound.
  2. Fill scenes/fixtures/${fixtureName} with every property you validate, at
     VALID values — fixtureLint requires zero errors on a unit-* fixture.
  3. pnpm docs:lint-sections — fills the sheet's generated Linting block, and
     rewrite the lenient-parser prose under it. CI checks both.
  4. pnpm --filter @textscene/core test -- ${lower} && npx eslint <changed files>
  5. pnpm build:linter && pnpm lint:tscn scenes/fixtures/${fixtureName}${
    intent === 'pending'
      ? `
  6. When someone renders it: add index.r3f.ts, wire r3f/nodes/index.ts, and move
     the sheet off \`status: unimplemented\`.`
      : intent === 'transform-only'
        ? ''
        : `
  6. Uncomment \`image:\` in comparison.md, then pnpm recapture --only ${imageBasename}`
  }`);
}

main();
