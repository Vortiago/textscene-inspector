/**
 * A node grafted into an instanced sub-scene resolves its ids against the scene
 * that AUTHORED it, for BOTH kinds of id.
 *
 * `.tscn` ids are per-file: `SubResource("1")` in the host scene and
 * `SubResource("1")` in the scene it instances are unrelated resources that
 * happen to share a name. A host child parented deep inside an instance renders
 * under the sub-scene's provider, so without its authoring scope it reads the
 * sub-scene's `1` — a resource that exists, parses, and draws, which is why this
 * fails as something plausible rather than as nothing.
 *
 * Only a COLLISION can tell the two apart: `SceneResourcesProvider` inherits the
 * ambient pool, so a host id absent from the sub-scene resolves either way. That
 * is what kept this open — and Godot's own ids collide readily, since a
 * hand-written scene numbers its sub-resources from 1.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode, TscnScene } from '../parser/types';
import { NodeDispatcher } from './NodeDispatcher';
import { SelectionProvider } from './contexts/SelectionContext';
import { SceneResourcesProvider } from './SceneResourcesContext';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { initGlbModules } from '../resources/processing/glbProcessing';

import './nodes/index';

beforeAll(async () => {
  await initGlbModules();
});

const SUB_SCENE = 'res://sub.tscn';

/** The instanced scene: one root, and a `1` of its own that must NOT win. */
function subScene(): TscnScene {
  return {
    nodes: [
      {
        name: 'SubRoot',
        type: 'Node3D',
        children: [{ name: 'Anchor', type: 'Node3D', children: [], properties: { name: 'Anchor' } }],
        properties: { name: 'SubRoot' },
      },
    ],
    externalResources: [],
    internalResources: [
      // Same id, different resource — BLUE.
      { id: '1', type: 'StandardMaterial3D', data: { albedo_color: 'Color(0, 0, 1, 1)' } },
    ],
  };
}

/** The host's deep child, parented INSIDE the instance at `Anchor`. */
function hostGraftedMesh(): TscnNode {
  return {
    name: 'Painted',
    type: 'MeshInstance3D',
    children: [],
    instanceSubPath: 'Anchor',
    properties: {
      name: 'Painted',
      mesh: 'SubResource("Box")',
      // Authored in the HOST, so this `1` is the host's RED one.
      materialOverride: 'SubResource("1")',
      surfaceMaterialOverrides: new Map(),
    },
  };
}

async function render() {
  const fake = createFakeResourceLoader();
  fake.scenes.seed(SUB_SCENE, subScene());

  const instancing: TscnNode = {
    name: 'Instanced',
    type: 'Node3D',
    instance: 'ExtResource("sub")',
    children: [hostGraftedMesh()],
    properties: { name: 'Instanced' },
  };

  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider
        internalResources={[
          { id: 'Box', type: 'BoxMesh', data: { size: 'Vector3(1, 1, 1)' } },
          { id: '1', type: 'StandardMaterial3D', data: { albedo_color: 'Color(1, 0, 0, 1)' } },
        ]}
        externalResources={[{ id: 'sub', path: SUB_SCENE, type: 'PackedScene' }]}
      >
        <SelectionProvider>
          <NodeDispatcher nodes={[instancing]} />
        </SelectionProvider>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

describe('a grafted node resolves SubResource ids against its authoring scene', () => {
  it('takes the HOST material when both scenes declare the same id', async () => {
    const renderer = await render();

    const mesh = renderer.scene
      .findAllByType('Mesh')
      .map((m) => m.instance as THREE.Mesh)
      .find((m) => m.name === 'Painted');
    expect(mesh, 'the grafted mesh should render').toBeDefined();

    const material = (
      Array.isArray(mesh!.material) ? mesh!.material[0] : mesh!.material
    ) as THREE.MeshStandardMaterial;
    const linear = material.color.getRGB(
      { r: 0, g: 0, b: 0 } as THREE.Color,
      THREE.LinearSRGBColorSpace
    );

    expect(linear.r).toBeCloseTo(1, 5);
    expect(linear.b).toBeCloseTo(0, 5);
  });
});
