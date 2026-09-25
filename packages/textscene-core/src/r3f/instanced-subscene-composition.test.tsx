/**
 * An instanced sub-scene's mesh inherits the instancing node's transform exactly. PhotoFrameA's
 * authored Y=3.008 sits above its wall-mates at Y≈2.0–2.5, and the previewer reproduces it, as
 * Godot does.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode, TscnScene, TscnInternalResource } from '../parser/types';
import { NodeDispatcher } from './NodeDispatcher';
import { SceneStack } from './testing/SceneStack';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import type { ResourceLoader } from '../resources/ResourceLoader';

import './nodes/index';

/** A PhotoFrame sub-scene: root Node3D with an identity Canvas MeshInstance3D. */
function makePhotoFrameScene(canvasName: string): TscnScene {
  const internalResources: TscnInternalResource[] = [
    { id: 'Plane_1', type: 'PlaneMesh', data: { id: 'Plane_1', size: 'Vector2(0.5, 0.5)' } },
  ];
  return {
    nodes: [
      {
        name: 'FrameRoot',
        type: 'Node3D',
        children: [
          {
            name: canvasName,
            type: 'MeshInstance3D',
            children: [],
            properties: {
              name: canvasName,
              mesh: 'SubResource("Plane_1")',
              surfaceMaterialOverrides: new Map(),
            } as Record<string, unknown>,
          },
        ],
        properties: { name: 'FrameRoot' } as Record<string, unknown>,
      },
    ],
    externalResources: [],
    internalResources,
  };
}

/**
 * A PhotoFrame instancing node with the authored origin. Its ExtResource id derives from `name`,
 * and `renderFrame`'s `ref` argument resolves the path.
 */
function makeFrameInstanceNode(
  name: string,
  origin: { x: number; y: number; z: number }
): TscnNode {
  return {
    name,
    type: 'Node',
    instance: `ExtResource("${name}_ref")`,
    children: [],
    properties: {
      name,
      // The PhotoFrames use a Y-rotation basis. Identity is enough to pin origin inheritance.
      transform: {
        basis_x: { x: 1, y: 0, z: 0 },
        basis_y: { x: 0, y: 1, z: 0 },
        basis_z: { x: 0, y: 0, z: 1 },
        origin,
      },
    } as Record<string, unknown>,
  };
}

async function renderFrame(
  loader: ResourceLoader,
  node: TscnNode,
  ref: { id: string; path: string }
) {
  return ReactThreeTestRenderer.create(
    <SceneStack
      loader={loader}
      scene={{
        internalResources: [],
        externalResources: [{ id: ref.id, path: ref.path, type: 'PackedScene' }],
      }}
    >
      <NodeDispatcher nodes={[node]} />
    </SceneStack>
  );
}

function canvasWorldPosition(
  renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>,
  name: string
): THREE.Vector3 {
  const mesh = renderer.scene.findAllByType('Mesh').find((m) => m.instance.name === name);
  expect(mesh, `Canvas mesh "${name}" should render`).toBeDefined();
  const obj = mesh!.instance as THREE.Object3D;
  let top: THREE.Object3D = obj;
  while (top.parent) top = top.parent;
  top.updateMatrixWorld(true);
  return obj.getWorldPosition(new THREE.Vector3());
}

// Authored origins captured from a real-world hallway scene.
const FRAMES = [
  { name: 'PhotoFrameA', origin: { x: 8.548, y: 3.008, z: -1.625 } },
  { name: 'PhotoFrameB', origin: { x: 0.75, y: 2, z: -1.625 } },
];

describe('PhotoFrame composition — Canvas mesh inherits the authored instance origin', () => {
  it.each(FRAMES)(
    '$name Canvas world position == authored instance origin',
    async ({ name, origin }) => {
      const fake = createFakeResourceLoader();
      const scenePath = `res://${name}.tscn`;
      fake.scenes.seed(scenePath, makePhotoFrameScene('Canvas'));

      const renderer = await renderFrame(
        fake.loader,
        makeFrameInstanceNode(name, origin),
        { id: `${name}_ref`, path: scenePath }
      );

      const pos = canvasWorldPosition(renderer, 'Canvas');
      expect(pos.x).toBeCloseTo(origin.x, 4);
      expect(pos.y).toBeCloseTo(origin.y, 4);
      expect(pos.z).toBeCloseTo(origin.z, 4);
    }
  );

  it('PhotoFrameA renders at its authored Y=3.008 (data outlier, faithfully reproduced — not a renderer bug)', async () => {
    const fake = createFakeResourceLoader();
    const origin = { x: 8.548, y: 3.008, z: -1.625 };
    fake.scenes.seed('res://PhotoFrameA.tscn', makePhotoFrameScene('Canvas'));

    const renderer = await renderFrame(
      fake.loader,
      makeFrameInstanceNode('PhotoFrameA', origin),
      { id: 'PhotoFrameA_ref', path: 'res://PhotoFrameA.tscn' }
    );

    const pos = canvasWorldPosition(renderer, 'Canvas');
    // The previewer matches Godot: it reproduces Y=3.008 and does not "correct" it to ~2.0.
    expect(pos.y).toBeCloseTo(3.008, 4);
    expect(pos.y).not.toBeCloseTo(2.0, 1);
  });
});
