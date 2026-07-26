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
 *   --base <node3d|node2d|node>  base slice to extend (default: node3d)
 *   --transform-only             ADR-0008 non-visual node: reuse the base
 *                                parser and component (no own parser/Component)
 *   --linter                     generate strict validators + linter wiring
 *   --dry-run                    print the plan without writing anything
 *
 * Examples:
 *   pnpm new:node Marker3D 3d --base node3d --transform-only
 *   pnpm new:node Decal 3d --linter
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

const BASES = {
  node3d: {
    dir: 'base/node3d',
    parser: 'parseNode3D',
    component: 'Node3D',
    propsType: 'Node3DProperties',
    transformValidator: "transform: v.transform3d('transform'),",
    parserTestCases: NODE3D_PARSER_TEST_CASES,
    linterTransformValue: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)',
    linterBadTransformValue: 'Transform3D(nope)',
  },
  node2d: {
    dir: 'base/node2d',
    parser: 'parseNode2D',
    component: 'Node2D',
    propsType: 'Node2DProperties',
    transformValidator:
      "transform: v.transform2d('transform'),\n  position: v.vector2('position'),",
    parserTestCases: NODE2D_PARSER_TEST_CASES,
    linterTransformValue: 'Transform2D(1, 0, 0, 1, 0, 0)',
    linterBadTransformValue: 'Transform2D(nope)',
  },
  node: {
    dir: 'node',
    parser: 'parseNode',
    component: 'Node',
    propsType: 'NodeProperties',
    transformValidator: "transform: v.transform3d('transform'),",
    parserTestCases: NODE3D_PARSER_TEST_CASES,
    linterTransformValue: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)',
    linterBadTransformValue: 'Transform3D(nope)',
  },
};

function fail(message) {
  console.error(`[new-node-slice] ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const positional = [];
  const opts = { base: 'node3d', transformOnly: false, linter: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') opts.base = argv[++i];
    else if (a === '--transform-only') opts.transformOnly = true;
    else if (a === '--linter') opts.linter = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a.startsWith('--')) fail(`unknown option: ${a}`);
    else positional.push(a);
  }
  if (positional.length !== 2) {
    fail('usage: pnpm new:node <TypeName> <category-dir> [--base node3d|node2d|node] [--transform-only] [--linter] [--dry-run]');
  }
  const [typeName, category] = positional;
  if (!/^[A-Z][A-Za-z0-9]*$/.test(typeName)) fail(`TypeName must be PascalCase, got: ${typeName}`);
  if (!/^[a-z0-9/]+$/.test(category)) fail(`category-dir must be lowercase path segments, got: ${category}`);
  if (!BASES[opts.base]) fail(`--base must be one of ${Object.keys(BASES).join('|')}, got: ${opts.base}`);
  return { typeName, category, ...opts };
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
  const { typeName, category, base: baseKey, transformOnly, linter, dryRun } = parseArgs(
    process.argv.slice(2)
  );
  const base = BASES[baseKey];
  const lower = typeName.toLowerCase();
  const camel = typeName[0].toLowerCase() + typeName.slice(1);
  const kebabName = kebab(typeName);

  const sliceRel = `nodes/${category}/${lower}`;
  const sliceDir = join(CORE_SRC, sliceRel);
  if (existsSync(sliceDir)) fail(`slice already exists: ${sliceDir}`);

  const catDepth = category.split('/').length;
  const toSrc = '../'.repeat(catDepth + 2); // slice dir → src/
  const toBase = '../'.repeat(catDepth + 1) + base.dir; // slice dir → base slice

  const files = new Map(); // relative-to-slice name → content

  if (transformOnly) {
    files.set(
      'index.ts',
      `/**
 * ${typeName} registration — parser.
 *
 * Non-visual node: renders as a transform-only group (ADR-0008), reusing the
 * ${base.component} transform parse; the render component (index.r3f.ts) reuses ${base.component}.
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
    files.set(
      'index.r3f.ts',
      `/** ${typeName} renders as a transform-only group — reuse the ${base.component} component (ADR-0008). */

import { nodeComponentRegistry } from '${toSrc}r3f/NodeComponentRegistry';
import { ${base.component} } from '${toBase}/Component';

nodeComponentRegistry.register({ typeName: '${typeName}', Component: ${base.component} });
`
    );
    files.set(
      `${lower}.test.ts`,
      `/**
 * ${typeName} registration smoke tests (transform-only slice, ADR-0008).
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

  it('registers the ${base.component} render component (transform-only group)', () => {
    expect(nodeComponentRegistry.get('${typeName}')).toBe(${base.component});
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
      `/** ${typeName} strict validators for linting. */

import { validatorRegistry } from '${toSrc}linter/ValidatorRegistry.js';
import { v } from '${toSrc}linter/validators/index.js';

validatorRegistry.registerAll('${typeName}', {
  ${base.transformValidator}
});
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
 * Tests for ${typeName} strict validators (format validation).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '${toSrc}linter/Linter';
import './linterParser';

function errorsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.severity === 'error');
}

describe('${typeName} strict validators', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('passes a valid ${typeName} with a transform', () => {
    const content = \`[gd_scene format=3]

[node name="X" type="${typeName}"]
transform = ${base.linterTransformValue}
\`;

    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('rejects a malformed transform', () => {
    const content = \`[gd_scene format=3]

[node name="X" type="${typeName}"]
transform = ${base.linterBadTransformValue}
\`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('transform');
  });
});
`
    );
  }

  const fixtureName = `unit-${kebabName}.tscn`;
  const fixturePath = join(REPO_ROOT, 'scenes/fixtures', fixtureName);
  const fixtureContent =
    baseKey === 'node2d'
      ? `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="My${typeName}" type="${typeName}" parent="."]
position = Vector2(10, 20)
`
      : `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="My${typeName}" type="${typeName}" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)
`;

  const wirings = [
    wireImport(
      join(CORE_SRC, 'parser/TscnParser.ts'),
      `import '../${sliceRel}/index.js';`,
      `'../nodes/${category}/`
    ),
    wireImport(
      join(CORE_SRC, 'r3f/nodes/index.ts'),
      `import '../../${sliceRel}/index.r3f';`,
      `'../../nodes/${category}/`
    ),
  ];
  if (linter) {
    wirings.push(
      wireImport(
        join(CORE_SRC, 'linter/index.ts'),
        `import '../${sliceRel}/index.linter.js';`,
        `'../nodes/${category}/`
      )
    );
  }

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
  const sheetCategory = transformOnly
    ? 'Other'
    : /2D$/.test(typeName)
      ? '2D'
      : /3D$/.test(typeName)
        ? '3D'
        : baseKey === 'node2d'
          ? '2D'
          : '3D';
  files.set(
    'comparison.md',
    `---
type: ${typeName}
category: ${sheetCategory}
status: unreviewed
fixture: ${fixtureName}
# image: ${imageBasename}
renders_as: ${transformOnly ? 'a transform-only group' : 'TBD — one short noun phrase'}
---

# ${typeName}

${transformOnly
      ? `Non-visual node: the previewer renders it as a transform-only group (ADR-0008), so it draws nothing of its own and its children still show.`
      : `One or two sentences: what the node is, and what the previewer draws for it.`}

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

  console.log(`[new-node-slice] ${typeName} → ${sliceRel} (base: ${baseKey}${transformOnly ? ', transform-only' : ''}${linter ? ', linter' : ''})`);
  for (const name of files.keys()) console.log(`  create  ${sliceRel}/${name}`);
  console.log(`  create  scenes/fixtures/${fixtureName}`);
  for (const w of wirings) console.log(`  wire    ${w.filePath.slice(REPO_ROOT.length + 1)} (${w.action})`);

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
  1. Implement real parsed properties in ${sliceRel}/ (types, parser, Component)
  2. pnpm docs:lint-sections — fills the sheet's generated Linting block, and
     rewrite the lenient-parser prose under it. CI checks both.
  3. pnpm type-check && pnpm --filter @textscene/core test
  4. pnpm build:linter && pnpm lint:tscn scenes/fixtures/${fixtureName}
  5. Uncomment \`image:\` in comparison.md, then pnpm recapture --only ${imageBasename}`);
}

main();
