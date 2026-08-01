import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../../parser/types';
import { parseCSGPolygon3D } from './parser';
// Imports the wired slice, not the bare component: CsgPrimitive builds the solid
// from the registered builder, so the registration is part of what is under test.
import { CSGPolygon3D } from './index.r3f';
import type { CSGPolygon3DProperties, CSGPolygon3DResolvedPath } from './types';

function makeNode(
  overrides: Record<string, string> = {},
  resolvedPath?: CSGPolygon3DResolvedPath
): TscnNode {
  const properties = parseCSGPolygon3D(
    { type: 'node', attributes: { type: 'CSGPolygon3D', name: 'Poly' } },
    overrides
  ) as CSGPolygon3DProperties;
  if (resolvedPath) properties.resolvedPath = resolvedPath;
  return { name: 'Poly', type: 'CSGPolygon3D', children: [], properties };
}

async function render(node: TscnNode, internalResources: TscnInternalResource[] = []) {
  return ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={internalResources}>
      <CSGPolygon3D node={node} />
    </SceneResourcesProvider>
  );
}

function geometryOf(renderer: Awaited<ReturnType<typeof render>>): THREE.BufferGeometry {
  return (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry as THREE.BufferGeometry;
}

const zero = { x: 0, y: 0, z: 0 };

describe('<CSGPolygon3D>', () => {
  it('extrudes the default unit square toward -Z', async () => {
    const geom = geometryOf(await render(makeNode()));
    geom.computeBoundingBox();
    expect(geom.boundingBox!.min.z).toBeCloseTo(-1, 5);
    expect(geom.boundingBox!.max.z).toBeCloseTo(0, 5);
  });

  it('builds the Slope witness at the requested depth', async () => {
    const geom = geometryOf(
      await render(makeNode({ polygon: 'PackedVector2Array(0, -1, 0, 0, 2, -1)', depth: '2.0' }))
    );
    geom.computeBoundingBox();
    expect(geom.boundingBox!.max.x).toBeCloseTo(2, 5);
    expect(geom.boundingBox!.min.z).toBeCloseTo(-2, 5);
  });

  it('revolves in SPIN mode', async () => {
    const geom = geometryOf(
      await render(
        makeNode({
          polygon: 'PackedVector2Array(0.6, -0.5, 1, -0.5, 1, 0.5, 0.6, 0.5)',
          mode: '1',
          spin_degrees: '360',
          spin_sides: '24',
        })
      )
    );
    geom.computeBoundingBox();
    // A full revolution of a profile reaching x = 1 sweeps a disc of radius 1.
    expect(geom.boundingBox!.max.x).toBeCloseTo(1, 2);
    expect(geom.boundingBox!.min.x).toBeCloseTo(-1, 2);
  });

  it('renders nothing in PATH mode until the path pass has resolved path_node', async () => {
    // The component cannot reach a sibling itself, so an unresolved path is a normal
    // intermediate state rather than an error.
    const geom = geometryOf(await render(makeNode({ mode: '2', path_node: 'NodePath("../Path3D")' })));
    expect(geom.getAttribute('position').count).toBe(0);
  });

  it('sweeps along the curve once the path pass has supplied it', async () => {
    const geom = geometryOf(
      await render(
        makeNode({ mode: '2', path_rotation: '0', path_interval: '1', path_local: 'true' }, {
          curvePoints: [
            { in: zero, out: zero, position: { x: 0, y: 0, z: 0 } },
            { in: zero, out: zero, position: { x: 0, y: 0, z: -4 } },
          ],
          baseTransform: null,
        })
      )
    );
    geom.computeBoundingBox();
    expect(geom.boundingBox!.min.z).toBeCloseTo(-4, 3);
  });

  it('applies the StandardMaterial3D albedo from a SubResource', async () => {
    const material: TscnInternalResource = {
      id: 'StandardMaterial3D_poly',
      type: 'StandardMaterial3D',
      data: { albedo_color: 'Color(0.65, 0.6, 0.5, 1)' },
    };
    const renderer = await render(
      makeNode({ material: 'SubResource("StandardMaterial3D_poly")' }),
      [material]
    );
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh)
      .material as THREE.MeshStandardMaterial;
    expect(mat.color.r).toBeGreaterThan(0);
    expect(mat.color.r).toBeGreaterThan(mat.color.b);
  });

  it('positions the solid at the node transform origin', async () => {
    const renderer = await render(
      makeNode({ transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -3, 1, 1)' })
    );
    const group = renderer.scene.findByType('Group').instance as THREE.Group;
    expect(group.position.x).toBeCloseTo(-3, 5);
    expect(group.position.y).toBeCloseTo(1, 5);
  });

  it('renders children inside the transform group', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SceneResourcesProvider internalResources={[]}>
        <CSGPolygon3D node={makeNode()}>
          <mesh name="injected-child" />
        </CSGPolygon3D>
      </SceneResourcesProvider>
    );
    expect(
      renderer.scene.find((n) => (n.instance as THREE.Object3D).name === 'injected-child')
    ).toBeTruthy();
  });

  it('renders empty geometry without throwing on a malformed polygon', async () => {
    const geom = geometryOf(await render(makeNode({ polygon: 'PackedVector2Array(broken' })));
    expect(geom.getAttribute('position').count).toBe(0);
  });
});
