/**
 * Three levels of nested external scenes through the R3F pipeline. Each
 * single-root sub-scene merges into its instance node (ADR-0013), which keeps
 * its own transform. A missing sub-scene leaves the instance node with a
 * placeholder and none of the deeper nodes.
 */

import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode, TscnScene } from '../parser/types';
import { NodeDispatcher } from './NodeDispatcher';
import { SelectionProvider } from './contexts/SelectionContext';
import { SceneResourcesProvider } from './SceneResourcesContext';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import type { ResourceLoader } from '../resources/ResourceLoader';

import './nodes/index';

function makeNode(name: string, type: string, overrides: Partial<TscnNode> = {}): TscnNode {
  return {
    name,
    type,
    children: [],
    properties: { name } as Record<string, unknown>,
    ...overrides,
  };
}

// Level 3 (leaf): an orange sphere with no dependencies.
function makeLeafScene(): TscnScene {
  return {
    nodes: [
      makeNode('NestedLeaf', 'Node3D', {
        children: [
          makeNode('LeafSphere', 'MeshInstance3D', {
            properties: {
              name: 'LeafSphere',
              mesh: 'SubResource("SphereMesh_1")',
              surfaceMaterialOverrides: new Map(),
            } as Record<string, unknown>,
          }),
        ],
      }),
    ],
    externalResources: [],
    internalResources: [
      { id: 'SphereMesh_1', type: 'SphereMesh', data: { radius: '0.5' } },
      { id: 'Material_1', type: 'StandardMaterial3D', data: { albedo_color: 'Color(1, 0.6, 0.2, 1)' } },
    ],
  };
}

// Level 2 (middle): Blue box + references leaf
function makeMiddleScene(): TscnScene {
  return {
    nodes: [
      makeNode('NestedMiddle', 'Node3D', {
        children: [
          makeNode('MiddleBox', 'MeshInstance3D', {
            properties: {
              name: 'MiddleBox',
              transform: {
                basis_x: { x: 1, y: 0, z: 0 },
                basis_y: { x: 0, y: 1, z: 0 },
                basis_z: { x: 0, y: 0, z: 1 },
                origin: { x: -2, y: 0, z: 0 },
              },
              mesh: 'SubResource("BoxMesh_1")',
              surfaceMaterialOverrides: new Map(),
            } as Record<string, unknown>,
          }),
          makeNode('LeafInstance', 'Node3D', {
            instance: 'ExtResource("1_leaf")',
            properties: {
              name: 'LeafInstance',
              transform: {
                basis_x: { x: 1, y: 0, z: 0 },
                basis_y: { x: 0, y: 1, z: 0 },
                basis_z: { x: 0, y: 0, z: 1 },
                origin: { x: 2, y: 0, z: 0 },
              },
            } as Record<string, unknown>,
          }),
        ],
      }),
    ],
    externalResources: [{ id: '1_leaf', path: 'res://test-nested-leaf.tscn', type: 'PackedScene' }],
    internalResources: [
      { id: 'BoxMesh_1', type: 'BoxMesh', data: { size: 'Vector3(1, 1, 1)' } },
    ],
  };
}

// Level 1 (top): Green cylinder + references middle
function makeTopScene(): TscnScene {
  return {
    nodes: [
      makeNode('NestedTop', 'Node3D', {
        children: [
          makeNode('TopCylinder', 'MeshInstance3D', {
            properties: {
              name: 'TopCylinder',
              transform: {
                basis_x: { x: 1, y: 0, z: 0 },
                basis_y: { x: 0, y: 1, z: 0 },
                basis_z: { x: 0, y: 0, z: 1 },
                origin: { x: 0, y: 0, z: -3 },
              },
              mesh: 'SubResource("CylinderMesh_1")',
              surfaceMaterialOverrides: new Map(),
            } as Record<string, unknown>,
          }),
          makeNode('MiddleInstance', 'Node3D', {
            instance: 'ExtResource("1_middle")',
            properties: {
              name: 'MiddleInstance',
              transform: {
                basis_x: { x: 1, y: 0, z: 0 },
                basis_y: { x: 0, y: 1, z: 0 },
                basis_z: { x: 0, y: 0, z: 1 },
                origin: { x: 0, y: 0, z: 3 },
              },
            } as Record<string, unknown>,
          }),
        ],
      }),
    ],
    externalResources: [{ id: '1_middle', path: 'res://test-nested-middle.tscn', type: 'PackedScene' }],
    internalResources: [
      { id: 'CylinderMesh_1', type: 'CylinderMesh', data: { height: '2.0' } },
    ],
  };
}

async function renderTopScene(
  loader: ResourceLoader,
  extraExternalResources?: TscnScene['externalResources']
) {
  const topScene = makeTopScene();
  const externalResources = extraExternalResources ?? topScene.externalResources;

  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={loader}>
      <SceneResourcesProvider
        internalResources={topScene.internalResources}
        externalResources={externalResources}
      >
        <SelectionProvider>
          <NodeDispatcher nodes={topScene.nodes} />
        </SelectionProvider>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

describe('NodeDispatcher — nested external scenes (3+ levels)', () => {
  describe('3-Level Hierarchy Resolution', () => {
    it('resolves and renders all 3 levels of nested external scenes', async () => {
      const fake = createFakeResourceLoader();
      fake.scenes.seed('res://test-nested-leaf.tscn', makeLeafScene());
      fake.scenes.seed('res://test-nested-middle.tscn', makeMiddleScene());

      const renderer = await renderTopScene(fake.loader);

      const groups = renderer.scene.findAllByType('Group');
      const groupNames = groups.map((g) => g.instance.name);

      // Level 1: Top scene node.
      expect(groupNames).toContain('NestedTop');

      // Level 2: 'NestedMiddle' merged into the instance node 'MiddleInstance',
      // which keeps its child 'LeafInstance'.
      expect(groupNames).toContain('MiddleInstance');
      expect(groupNames).not.toContain('NestedMiddle');
      expect(groupNames).toContain('LeafInstance');

      // Level 3: 'LeafInstance' collapsed into 'NestedLeaf'; the leaf content
      // (LeafSphere mesh) is what proves the deepest level resolved.
      expect(groupNames).not.toContain('NestedLeaf');
      const meshNames = renderer.scene.findAllByType('Mesh').map((m) => m.instance.name);
      expect(meshNames).toContain('LeafSphere');
    });

    it('creates THREE.js objects for all nested levels', async () => {
      const fake = createFakeResourceLoader();
      fake.scenes.seed('res://test-nested-leaf.tscn', makeLeafScene());
      fake.scenes.seed('res://test-nested-middle.tscn', makeMiddleScene());

      const renderer = await renderTopScene(fake.loader);

      // Level 1 objects
      const groups = renderer.scene.findAllByType('Group');
      const nestedTopGroup = groups.find((g) => g.instance.name === 'NestedTop');
      expect(nestedTopGroup?.instance.isObject3D).toBe(true);

      // Level 2 object: the collapsed instance node carries the level-2 root.
      const nestedMiddleGroup = groups.find((g) => g.instance.name === 'MiddleInstance');
      expect(nestedMiddleGroup?.instance.isObject3D).toBe(true);

      // Level 3 merged into 'LeafInstance' too.
      const nestedLeafGroup = groups.find((g) => g.instance.name === 'LeafInstance');
      expect(nestedLeafGroup?.instance.isObject3D).toBe(true);

      const meshes = renderer.scene.findAllByType('Mesh');
      const leafSphere = meshes.find((m) => m.instance.name === 'LeafSphere');
      expect((leafSphere?.instance as THREE.Mesh | undefined)?.isMesh).toBe(true);
    });

    it('applies transforms correctly across nested levels', async () => {
      const fake = createFakeResourceLoader();
      fake.scenes.seed('res://test-nested-leaf.tscn', makeLeafScene());
      fake.scenes.seed('res://test-nested-middle.tscn', makeMiddleScene());

      const renderer = await renderTopScene(fake.loader);

      // MiddleInstance has origin z=3
      const groups = renderer.scene.findAllByType('Group');
      const middleInstanceGroup = groups.find((g) => g.instance.name === 'MiddleInstance');
      expect(middleInstanceGroup).toBeDefined();
      expect(middleInstanceGroup!.instance.position.z).toBeCloseTo(3, 5);

      // LeafInstance (inside middle) has origin x=2
      const leafInstanceGroup = groups.find((g) => g.instance.name === 'LeafInstance');
      expect(leafInstanceGroup).toBeDefined();
      expect(leafInstanceGroup!.instance.position.x).toBeCloseTo(2, 5);
    });
  });

  describe('Error Handling for Deep Nesting', () => {
    it('still renders Level 1 nodes when Level 2 scene is missing', async () => {
      const fake = createFakeResourceLoader();
      // Only leaf is cached, middle is missing
      fake.scenes.seed('res://test-nested-middle.tscn', null);

      const renderer = await renderTopScene(fake.loader);

      const groups = renderer.scene.findAllByType('Group');
      const groupNames = groups.map((g) => g.instance.name);

      // Level 1 should still exist
      expect(groupNames).toContain('NestedTop');
      expect(groupNames).toContain('MiddleInstance');

      // Level 2 should not exist (middle scene failed to load)
      expect(groupNames).not.toContain('NestedMiddle');

      // Level 3 should not exist
      expect(groupNames).not.toContain('NestedLeaf');
    });

    it('still renders Level 1 and Level 2 when Level 3 (leaf) scene is missing', async () => {
      const fake = createFakeResourceLoader();
      fake.scenes.seed('res://test-nested-middle.tscn', makeMiddleScene());
      fake.scenes.seed('res://test-nested-leaf.tscn', null);

      const renderer = await renderTopScene(fake.loader);

      const groups = renderer.scene.findAllByType('Group');
      const groupNames = groups.map((g) => g.instance.name);

      // Level 1 exists
      expect(groupNames).toContain('NestedTop');
      // Level 2 exists, merged into its instance node 'MiddleInstance'.
      expect(groupNames).toContain('MiddleInstance');
      expect(groupNames).not.toContain('NestedMiddle');
      // Level 3 does not exist (leaf scene missing); its instance node stays.
      expect(groupNames).toContain('LeafInstance');
      expect(groupNames).not.toContain('NestedLeaf');
    });
  });
});
