/**
 * The files a `draws` slice gets: its own types, parser, Component, their tests and the two
 * registrations. The registration carries `base.workspaceFlag`, since the canvas that draws a
 * type follows from its base. The indentation below is the emitted file's, not this module's.
 */

export function drawsFiles({ typeName, lower, camel, base, toSrc, toBase, reusedParser }) {
  const files = new Map();
  files.set(
    'types.ts',
    `/**
 * ${typeName}-specific type definitions.
 * Convert the alias to an interface extending ${reusedParser.propsType} when the
 * node grows its own parsed properties.
 */

import type { ${reusedParser.propsType} } from '${reusedParser.typesPath}';

export type ${typeName}Properties = ${reusedParser.propsType};
`
  );
  files.set(
    'parser.ts',
    `/**
 * ${typeName} parser — extends the ${reusedParser.fn} parse.
 */

import type { ParsedHeading } from '${toSrc}parser/utils';
import { ${reusedParser.fn} } from '${reusedParser.importPath}';
import type { ${typeName}Properties } from './types';

export function parse${typeName}(
  heading: ParsedHeading,
  properties: Record<string, string>
): ${typeName}Properties {
  const baseProperties = ${reusedParser.fn}(heading, properties);
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
    base.geometryInstanceDrawer
      ? geometryInstanceComponent(typeName, toSrc)
      : plainComponent(typeName, base, toSrc, toBase)
  );
  files.set(
    'Component.test.tsx',
    `import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '${toSrc}parser/types';
import { parse${typeName} } from './parser';
import './index.r3f';
import { registeredComponent } from '${toSrc}r3f/testing/registeredComponent';

const ${typeName} = registeredComponent('${typeName}');

const baseNode: TscnNode = {
  name: 'My${typeName}',
  type: '${typeName}',
  children: [],
  rawProperties: {},
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
${base.geometryInstanceDrawer ? '' : `\nexport { ${typeName} };\n`}`
  );
  // It imports `./index` itself, so it proves the slice's own self-registration and nothing
  // about the aggregation barrels, which `parserBarrelCompleteness` checks.
  files.set(
    `${lower}.test.ts`,
    `/**
 * ${typeName} registration — its parser and its component self-register on import.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '${toSrc}core/NodeRegistry';
import { nodeComponentRegistry } from '${toSrc}r3f/NodeComponentRegistry';
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
    ${registeredComponentAssertion(typeName, base)}
  });
});
`
  );
  return files;
}

/**
 * The registration test's check that the registry mounts the slice's component. The registry
 * mounts a GeometryInstance3D drawer in `withGeometryInstance`, so it checks the wrapper's name.
 */
function registeredComponentAssertion(typeName, base) {
  return base.geometryInstanceDrawer
    ? `expect(nodeComponentRegistry.get('${typeName}')?.displayName).toBe('withGeometryInstance(${typeName})');`
    : `expect(nodeComponentRegistry.get('${typeName}')).toBe(${typeName});`;
}

/** A transform group around the node's children, the base's own component. */
function plainComponent(typeName, base, toSrc, toBase) {
  return `/** ${typeName} render component — transform group wrapping children. */

import type { NodeComponentProps } from '${toSrc}r3f/NodeComponentRegistry';
import { ${base.component} } from '${toBase}/Component';

export function ${typeName}({ node, children }: NodeComponentProps) {
  return <${base.component} node={node}>{children}</${base.component}>;
}
`;
}

/**
 * A GeometryInstance3D's drawer, which the registry mounts in `withGeometryInstance` so the node
 * holds its place in the scene cull. It places the instance at its origin until it draws a box of
 * its own.
 */
function geometryInstanceComponent(typeName, toSrc) {
  return `/** ${typeName} render component — transform group wrapping children. */

import { useMemo, useRef } from 'react';
import type * as THREE from 'three';
import type { NodeComponentProps } from '${toSrc}r3f/NodeComponentRegistry';
import { Node3D } from '${toSrc}nodes/base/node3d/Component';
import { boxPlacement } from '${toSrc}r3f/visibilityRange/placements';
import { useGeometryInstance } from '${toSrc}r3f/visibilityRange/geometryInstance';

export function ${typeName}({ node, children }: NodeComponentProps) {
  const nodeRef = useRef<THREE.Group | null>(null);
  const placement = useMemo(() => boxPlacement(nodeRef, null), []);
  useGeometryInstance(placement);
  return (
    <Node3D node={node} ref={nodeRef}>
      {children}
    </Node3D>
  );
}
`;
}
