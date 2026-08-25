/**
 * The files a `draws` slice gets: its own types, parser, Component and the
 * tests for both, plus the two registrations.
 *
 * The registration carries `base.workspaceFlag` for the same reason the
 * transform-only template does: which canvas draws a type follows from its
 * base, not from whether it has a Component of its own.
 *
 * The indentation below is the emitted file's, not this module's.
 */

import { LENIENT_TREE_TEST_CASE } from './parserTests.mjs';

export function drawsFiles({ typeName, lower, camel, base, toSrc, toBase, reusedParser }) {
  const files = new Map();
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

nodeComponentRegistry.register({
  typeName: '${typeName}',
  Component: ${typeName},
${base.workspaceFlag ? `  ${base.workspaceFlag}\n` : ''}});

export { ${typeName} };
`
    );
    // The registration test the other two shapes already carry. Without it a
    // `draws` slice never loads either aggregation barrel, so a dropped import
    // in `parser/TscnParser.ts` or `r3f/nodes/index.ts` leaves every co-located
    // test green while the type falls back to Node at runtime.
    files.set(
      `${lower}.test.ts`,
      `/**
 * ${typeName} registration — the slice is wired into both aggregation barrels.
 */

import { describe, expect, it, vi } from 'vitest';
import { nodeRegistry } from '${toSrc}core/NodeRegistry';
import { nodeComponentRegistry } from '${toSrc}r3f/NodeComponentRegistry';
import { TscnParser } from '${toSrc}parser/TscnParser';
import * as logger from '${toSrc}logger';
import { parse${typeName} } from './parser';
import { ${typeName} } from './Component';
import './index';
import './index.r3f';

describe('${typeName} registration', () => {
  it('registers its own parser', () => {
    const registration = nodeRegistry.getRegistration('${typeName}');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parse${typeName});
  });

  it('registers its own component, so it reads as drawing', () => {
    expect(nodeComponentRegistry.get('${typeName}')).toBe(${typeName});
  });

${LENIENT_TREE_TEST_CASE(typeName, base.component)}
});
`
    );
  return files;
}
