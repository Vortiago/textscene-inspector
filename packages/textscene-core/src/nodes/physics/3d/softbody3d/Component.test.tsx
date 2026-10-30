/**
 * <SoftBody3D> draws Godot's wireframe gizmo: three segments per triangle of every surface in the
 * collision debug colour, for every node, faint while unselected (`soft_body_3d_gizmo_plugin.cpp:62-97`,
 * ADR-0056).
 */

import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { describe, expect, it } from 'vitest';
import { heading } from '../../../../parser/testing/parserKit';
import type { TscnInternalResource, TscnNode } from '../../../../parser/types';
import { NodePathProvider } from '../../../../r3f/contexts/NodePathContext';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';
import { InsideLockedInstance, lineOpacities, type TestRenderer } from '../../../../r3f/testing/GizmoScene';
import {
  describeGizmoToggle,
  describeInstantiatedGizmo,
  type GizmoNodeCase,
} from '../../../../r3f/testing/gizmoContract';
import { SceneStack } from '../../../../r3f/testing/SceneStack';
import { godotColorToLinear } from '../../../../r3f/godotColor';
import { subResource } from '../../../../testing/subResource';
import { parseMeshInstance3D } from '../../../3d/meshinstance3d/parser';
import { wallQuadSurfaces } from '../../../../resources/testing/arrayMeshSurfaces';
import { inlineTwoSurfaceMesh } from '../../../3d/meshinstance3d/testing/twoSurfaceMesh';
import { findMesh } from '../../../3d/testing/reactThreeTestInstance';
import { DEFAULT_COLLISION_DEBUG_COLOR } from '../../shared/debugColor';
import { registeredComponent } from '../../../../r3f/testing/registeredComponent';
import './index.r3f';

const NODE_NAME = 'Cloth';

/** `unit-softbody3d.tscn`'s mesh: 13 × 13 quads. */
const CLOTH = subResource('PlaneMesh', 'cloth', {
  size: 'Vector2(2, 2)',
  subdivide_width: '12',
  subdivide_depth: '12',
});
const BOX = subResource('BoxMesh', 'box', { size: 'Vector3(1, 1, 1)' });

function softBodyNode(rawProperties: Record<string, string>): TscnNode {
  return {
    name: NODE_NAME,
    type: 'SoftBody3D',
    rawProperties,
    children: [],
    properties: parseMeshInstance3D(heading('SoftBody3D', { name: NODE_NAME }), rawProperties),
  };
}

interface Place {
  selectedPath?: string | null;
  showGizmos?: boolean;
  instantiated?: boolean;
}

function renderSoftBody(
  mesh: string | null,
  resources: readonly TscnInternalResource[],
  { selectedPath = NODE_NAME, showGizmos = true, instantiated = false }: Place = {}
): Promise<TestRenderer> {
  const SoftBody3D = registeredComponent('SoftBody3D');
  const softBody = <SoftBody3D node={softBodyNode(mesh ? { mesh } : {})} />;
  return ReactThreeTestRenderer.create(
    <SceneStack
      loader={createFakeResourceLoader().loader}
      scene={{ internalResources: resources }}
      selectedPath={selectedPath}
      showGizmos={showGizmos}
    >
      <NodePathProvider path={NODE_NAME}>
        {instantiated ? <InsideLockedInstance>{softBody}</InsideLockedInstance> : softBody}
      </NodePathProvider>
    </SceneStack>
  );
}

function wireframe(renderer: TestRenderer): THREE.LineSegments[] {
  return renderer.scene.findAllByType('LineSegments').map((line) => line.instance as THREE.LineSegments);
}

/** The flat segment ends of the one wireframe, or none. */
function segments(renderer: TestRenderer): number[] {
  const [line] = wireframe(renderer);
  return line ? Array.from(line.geometry.getAttribute('position').array) : [];
}

const GIZMO_CASE: GizmoNodeCase = {
  nodePath: NODE_NAME,
  drawnFor: 'every-node',
  mount: ({ selectedPath, showGizmos, instantiated }) =>
    renderSoftBody('SubResource("box")', [BOX], { selectedPath, showGizmos, instantiated }),
};
describeGizmoToggle('<SoftBody3D>', GIZMO_CASE);
describeInstantiatedGizmo('<SoftBody3D>', GIZMO_CASE);

describe('<SoftBody3D> wireframe', () => {
  it('draws 1014 segments over 533 distinct edges for the 12 × 12 PlaneMesh of unit-softbody3d', async () => {
    const flat = segments(await renderSoftBody('SubResource("cloth")', [CLOTH]));
    const ends = Array.from({ length: flat.length / 3 }, (_unused, i) => flat.slice(i * 3, i * 3 + 3).join());
    const edges = new Set<string>();
    for (let i = 0; i < ends.length; i += 2) edges.add([ends[i], ends[i + 1]].sort().join('|'));
    expect(ends.length / 2).toBe(1014);
    expect(edges.size).toBe(533);
  });

  it('starts the PlaneMesh at its first triangle, from (1, 0, 1) to (0.8462, 0, 1)', async () => {
    const [x0, y0, z0, x1, y1, z1] = segments(await renderSoftBody('SubResource("cloth")', [CLOTH]));
    expect([x0, y0, z0]).toEqual([1, 0, 1]);
    expect(x1).toBeCloseTo(0.8462, 4);
    expect([y1, z1]).toEqual([0, 1]);
  });

  it('draws 36 segments for the 12 triangles of a BoxMesh', async () => {
    expect(segments(await renderSoftBody('SubResource("box")', [BOX]))).toHaveLength(36 * 2 * 3);
  });

  it('draws the segments of both surfaces of a two-surface ArrayMesh', async () => {
    const renderer = await renderSoftBody('SubResource("walls")', [inlineTwoSurfaceMesh('walls')]);
    expect(segments(renderer).length / 6).toBe(12);
  });

  // `Mesh::generate_triangle_mesh` (`mesh.cpp:352-366`) reads a strip of indices 2, 0, 3, 2, 1, 0 as
  // the triangles (2, 0, 3), (0, 2, 3), (3, 2, 1) and (2, 0, 1).
  it('draws the wireframe of a triangle-strip surface, four triangles over six indices', async () => {
    const strip: TscnInternalResource = {
      id: 'strip',
      type: 'ArrayMesh',
      data: { _surfaces: wallQuadSurfaces({ primitive: 4 }) },
    };
    const flat = segments(await renderSoftBody('SubResource("strip")', [strip]));
    expect(flat).toHaveLength(12 * 2 * 3);
    expect(flat.slice(0, 6)).toEqual([1, 1, 1, -1, -1, 1]);
  });

  it('draws no wireframe, and no mesh, without a mesh', async () => {
    const renderer = await renderSoftBody(null, []);
    expect(wireframe(renderer)).toHaveLength(0);
    expect(findMesh(renderer.scene).geometry.attributes.position).toBeUndefined();
  });

  it('draws the rest mesh beside the wireframe', async () => {
    const renderer = await renderSoftBody('SubResource("box")', [BOX]);
    expect(findMesh(renderer.scene).geometry.attributes.position).toBeDefined();
  });

  it('draws no wireframe for a mesh with no triangle', async () => {
    const empty = subResource('PlaceholderMesh', 'empty', {});
    expect(wireframe(await renderSoftBody('SubResource("empty")', [empty]))).toHaveLength(0);
  });

  it('draws in the collision debug colour at its alpha, 0.42, when the node is selected', async () => {
    const renderer = await renderSoftBody('SubResource("box")', [BOX]);
    const [line] = wireframe(renderer);
    const material = line!.material as THREE.LineBasicMaterial;
    expect(material.color.toArray()).toEqual(godotColorToLinear(DEFAULT_COLLISION_DEBUG_COLOR).toArray());
    expect(lineOpacities(renderer)).toEqual([DEFAULT_COLLISION_DEBUG_COLOR.a]);
  });

  it('draws at 0.3 of that alpha, 0.126, when the node is not selected', async () => {
    const renderer = await renderSoftBody('SubResource("box")', [BOX], { selectedPath: null });
    expect(lineOpacities(renderer)[0]).toBeCloseTo(DEFAULT_COLLISION_DEBUG_COLOR.a * 0.3, 10);
  });
});
