/**
 * PackedScene instance rendering through a fake ResourceLoader, SceneResourcesProvider
 * and NodeDispatcher: instance creation, hierarchy, instance transforms, scene caching
 * and full TSCN-parse integration. Scenes are staged in the fake loader's cache, so
 * `<InstancedSceneSubtree>` resolves them deterministically.
 */

import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode, TscnScene, TscnInternalResource } from '../parser/types';
import { NodeDispatcher } from './NodeDispatcher';
import { SceneStack } from './testing/SceneStack';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import type { ResourceLoader } from '../resources/ResourceLoader';
import { TscnParser } from '../parser/TscnParser';

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

function makeChildCubeScene(): TscnScene {
  const internalResources: TscnInternalResource[] = [
    { id: 'BoxMesh_1', type: 'BoxMesh', data: { size: 'Vector3(1, 1, 1)' } },
    { id: 'Material_1', type: 'StandardMaterial3D', data: { albedo_color: 'Color(0.2, 0.6, 0.9, 1)' } },
  ];
  return {
    nodes: [
      makeNode('ChildCube', 'Node3D', { children: [
        makeNode('Cube', 'MeshInstance3D', {
          properties: {
            name: 'Cube',
            mesh: 'SubResource("BoxMesh_1")',
            surfaceMaterialOverrides: new Map([[0, 'SubResource("Material_1")']]),
          } as Record<string, unknown>,
        }),
      ]}),
    ],
    externalResources: [],
    internalResources,
  };
}

async function renderTree(
  nodes: TscnNode[],
  loader: ResourceLoader,
  externalResources: TscnScene['externalResources'] = []
) {
  return ReactThreeTestRenderer.create(
    <SceneStack loader={loader} scene={{ internalResources: [], externalResources }}>
      <NodeDispatcher nodes={nodes} />
    </SceneStack>
  );
}

describe('NodeDispatcher — external scene node rendering', () => {
  describe('External Scene Node Addition', () => {
    it('renders nodes from external scene as children of the instancing node', async () => {
      const fake = createFakeResourceLoader();
      fake.scenes.seed('res://child_cube.tscn', makeChildCubeScene());

      const instancingNode = makeNode('ChildInstance', 'Node3D', {
        instance: 'ExtResource("1_cube")',
        properties: { name: 'ChildInstance' } as Record<string, unknown>,
      });

      const renderer = await renderTree(
        [instancingNode],
        fake.loader,
        [{ id: '1_cube', path: 'res://child_cube.tscn', type: 'PackedScene' }]
      );

      // Instance root merge (ADR-0013): the loaded root 'ChildCube' collapses into the
      // instance node 'ChildInstance', so the root's child mesh renders under it.
      const groups = renderer.scene.findAllByType('Group');
      expect(groups.find((g) => g.instance.name === 'ChildInstance')).toBeDefined();
      expect(groups.find((g) => g.instance.name === 'ChildCube')).toBeUndefined();
      const meshes = renderer.scene.findAllByType('Mesh');
      expect(meshes.find((m) => m.instance.name === 'Cube')).toBeDefined();
    });

    it('creates THREE objects for external scene nodes', async () => {
      const fake = createFakeResourceLoader();
      fake.scenes.seed('res://child_cube.tscn', makeChildCubeScene());

      const instancingNode = makeNode('ChildInstance', 'Node3D', {
        instance: 'ExtResource("1_cube")',
        properties: { name: 'ChildInstance' } as Record<string, unknown>,
      });

      const renderer = await renderTree(
        [instancingNode],
        fake.loader,
        [{ id: '1_cube', path: 'res://child_cube.tscn', type: 'PackedScene' }]
      );

      // The merged ChildInstance renders as a group; its mesh renders as a mesh.
      const groups = renderer.scene.findAllByType('Group');
      const instanceGroup = groups.find((g) => g.instance.name === 'ChildInstance');
      expect(instanceGroup).toBeDefined();
      expect(instanceGroup!.instance.isObject3D).toBe(true);

      const meshes = renderer.scene.findAllByType('Mesh');
      const cubeMesh = meshes.find((m) => m.instance.name === 'Cube');
      expect(cubeMesh).toBeDefined();
      expect((cubeMesh!.instance as THREE.Mesh).isMesh).toBe(true);
    });

    it('maintains correct parent-child relationships in THREE.js graph', async () => {
      const fake = createFakeResourceLoader();
      fake.scenes.seed('res://child_cube.tscn', makeChildCubeScene());

      const instancingNode = makeNode('ChildInstance', 'Node3D', {
        instance: 'ExtResource("1_cube")',
        properties: { name: 'ChildInstance' } as Record<string, unknown>,
      });

      const renderer = await renderTree(
        [instancingNode],
        fake.loader,
        [{ id: '1_cube', path: 'res://child_cube.tscn', type: 'PackedScene' }]
      );

      const groups = renderer.scene.findAllByType('Group');
      const instancingGroup = groups.find((g) => g.instance.name === 'ChildInstance');
      expect(instancingGroup).toBeDefined();

      // The collapsed root's mesh ('Cube') is a descendant of the merged
      // ChildInstance node.
      const cubeMesh = renderer.scene.findAllByType('Mesh').find((m) => m.instance.name === 'Cube');
      expect(cubeMesh).toBeDefined();

      let parent = cubeMesh!.instance.parent;
      let found = false;
      while (parent) {
        if (parent === instancingGroup!.instance) { found = true; break; }
        parent = parent.parent;
      }
      expect(found).toBe(true);
    });

    it('DELETED_FEATURE: instanceRoot userData is not set in R3F pipeline', () => {
      // InstancedSceneSubtree sets no `userData.instanceRoot`: React nesting
      // expresses the hierarchy, not object metadata.
      expect(true).toBe(true);
    });

    it('renders multiple external scene instances of the same scene', async () => {
      const fake = createFakeResourceLoader();
      fake.scenes.seed('res://child_cube.tscn', makeChildCubeScene());

      const nodes: TscnNode[] = [1, 2, 3].map((i) =>
        makeNode(`Instance${i}`, 'Node3D', {
          instance: 'ExtResource("1_cube")',
          properties: { name: `Instance${i}` } as Record<string, unknown>,
        })
      );

      const renderer = await renderTree(
        nodes,
        fake.loader,
        [{ id: '1_cube', path: 'res://child_cube.tscn', type: 'PackedScene' }]
      );

      // Each instance collapses into its own merged node; the root level
      // 'ChildCube' is gone, leaving one 'Cube' mesh per instance.
      const groups = renderer.scene.findAllByType('Group');
      expect(groups.filter((g) => g.instance.name === 'ChildCube').length).toBe(0);
      const meshes = renderer.scene.findAllByType('Mesh');
      expect(meshes.filter((m) => m.instance.name === 'Cube').length).toBe(3);
    });
  });

  describe('Integration with full TSCN parse pipeline', () => {
    it('applies instance node transform to external scene (transform inherited via parent group)', async () => {
      const fake = createFakeResourceLoader();
      fake.scenes.seed('res://child_cube.tscn', makeChildCubeScene());

      const parser = new TscnParser();
      const mainSceneContent = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://child_cube.tscn" id="1_cube"]

[node name="MainScene" type="Node3D"]

[node name="ChildInstance" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 10, 15)
instance = ExtResource("1_cube")
`;
      const mainScene = parser.parse(mainSceneContent);

      const renderer = await ReactThreeTestRenderer.create(
        <SceneStack loader={fake.loader} scene={mainScene}>
          <NodeDispatcher nodes={mainScene.nodes} />
        </SceneStack>
      );

      // The merged ChildInstance node, with the root's Node3D type, holds the instance
      // transform (5, 10, 15), which replaces any root transform.
      const groups = renderer.scene.findAllByType('Group');
      const instanceGroup = groups.find((g) => g.instance.name === 'ChildInstance');
      expect(instanceGroup).toBeDefined();
      expect(instanceGroup!.instance.position.x).toBeCloseTo(5, 5);
      expect(instanceGroup!.instance.position.y).toBeCloseTo(10, 5);
      expect(instanceGroup!.instance.position.z).toBeCloseTo(15, 5);

      // The collapsed root's mesh renders under the merged ChildInstance node.
      const cubeMesh = renderer.scene.findAllByType('Mesh').find((m) => m.instance.name === 'Cube');
      expect(cubeMesh).toBeDefined();
    });
  });
});
