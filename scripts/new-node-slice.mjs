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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
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
    // `nodes/node/` registers no validators, so there is nothing to import.
    hasLinterParser: false,
  },
};

function fail(message) {
  console.error(`[new-node-slice] ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const positional = [];
  const opts = { base: 'node3d', intent: '', chain: '', linter: false, dryRun: false };
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
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a.startsWith('--')) fail(`unknown option: ${a}`);
    else positional.push(a);
  }
  if (positional.length !== 2) {
    fail(
      'usage: pnpm new:node <TypeName> <category-dir> --intent <draws|transform-only|pending> ' +
        '--chain <ParentType> [--base node3d|node2d|node|control] [--linter] [--dry-run]'
    );
  }
  const [typeName, category] = positional;
  if (!/^[A-Z][A-Za-z0-9]*$/.test(typeName)) fail(`TypeName must be PascalCase, got: ${typeName}`);
  if (!/^[a-z0-9/]+$/.test(category)) fail(`category-dir must be lowercase path segments, got: ${category}`);
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

function main() {
  const { typeName, category, base: baseKey, intent, chain, linter, dryRun } = parseArgs(
    process.argv.slice(2)
  );
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
import { ${base.parser} } from '${toBase}/parser';

const ${camel}Registration: NodeTypeRegistration = {
  typeName: '${typeName}',
  parser: ${base.parser},
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
  ${base.workspaceFlag}
  renderIntent: 'transform-only',
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

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '${toSrc}core/NodeRegistry';
import { nodeComponentRegistry } from '${toSrc}r3f/NodeComponentRegistry';
import { ${base.parser} } from '${toBase}/parser';
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
});
`
        : `/**
 * ${typeName} registration — parsed and validated, not yet rendered.
 *
 * Registering NO component is the point: the dispatcher falls back to
 * GenericNodeFallback, and \`rendersOwnVisual\` reports 'not-implemented' so the
 * tree and inspector keep saying so until someone draws it.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '${toSrc}core/NodeRegistry';
import { nodeComponentRegistry } from '${toSrc}r3f/NodeComponentRegistry';
import { ${base.parser} } from '${toBase}/parser';
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
import { ${base.parser} } from '${toBase}/parser';
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
 * lists without an \`overrides=\` attribute. Everything from ${base.component} up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

${base.hasLinterParser ? `import '${toBase}/linterParser.js';\n` : ''}import { validatorRegistry } from '${toSrc}linter/ValidatorRegistry.js';

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
