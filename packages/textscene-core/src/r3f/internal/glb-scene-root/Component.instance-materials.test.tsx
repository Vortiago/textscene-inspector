/**
 * `material_override` and `material_overlay` on a mesh inside an instanced GLB, which Godot
 * imports as a MeshInstance3D: the override draws every surface in place of its material, and the
 * overlay draws every surface again (`render_forward_clustered.cpp:4206`, `:4228-4241`).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { subResource } from '../../../testing/subResource';
import type { TscnInternalResource, TscnNode, TscnScene } from '../../../parser/types';
import { NodeDispatcher } from '../../NodeDispatcher';
import { SceneStack } from '../../testing/SceneStack';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { GLB_SCENE_ROOT_TYPE } from '../../../resources/glbSceneRoot';
import { INSTANTIABLE_SCENE } from '../../../parser/sceneDefaults.testkit';
import '../../nodes/index';

const GLB_PATH = 'res://assets/town.glb';
/** The glTF's own material: what draws where no override stands. */
const GLTF_COLOR = 0x123456;

const INTERNALS = [
  subResource('StandardMaterial3D', 'Mat_red', { albedo_color: 'Color(1, 0, 0, 1)' }),
  subResource('StandardMaterial3D', 'Mat_green', { albedo_color: 'Color(0, 1, 0, 1)' }),
  subResource('StandardMaterial3D', 'Mat_blue_alpha', {
    albedo_color: 'Color(0, 0, 1, 0.5)',
    transparency: '1',
  }),
  subResource('StandardMaterial3D', 'Mat_stencil_reader', {
    albedo_color: 'Color(0, 1, 1, 1)',
    stencil_mode: '3',
    stencil_flags: '1',
    stencil_compare: '5',
  }),
] as TscnInternalResource[];

function glbWithRoad(): THREE.Object3D {
  const root = new THREE.Group();
  root.name = 'Scene';
  const road = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: GLTF_COLOR })
  );
  road.name = 'road';
  root.add(road);
  return root;
}

/** A road of two primitives, which arrives as a Group that holds one mesh for each. */
function glbWithTwoPrimitiveRoad(): THREE.Object3D {
  const root = new THREE.Group();
  root.name = 'Scene';
  const road = new THREE.Group();
  road.name = 'road';
  for (const name of ['road_1', 'road_2']) {
    const primitive = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: GLTF_COLOR })
    );
    primitive.name = name;
    road.add(primitive);
  }
  root.add(road);
  return root;
}

const GLB_SCENE: TscnScene = {
  ...INSTANTIABLE_SCENE,
  nodes: [
    {
      rawProperties: {},
      name: 'town',
      type: GLB_SCENE_ROOT_TYPE,
      children: [],
      properties: { glbPath: GLB_PATH } as Record<string, unknown>,
    },
  ],
  externalResources: [],
  internalResources: [],
};

/** The instancing node, with one override of the GLB's road that sets `rawProperties`. */
function townWithRoad(rawProperties: Record<string, string>): TscnNode {
  return {
    rawProperties: {},
    name: 'town',
    type: 'Node3D',
    instance: 'ExtResource("glb_1")',
    children: [
      {
        name: 'road',
        type: 'Node',
        children: [],
        overridesExistingNode: true,
        rawProperties,
        properties: { name: 'road' } as Record<string, unknown>,
      },
    ],
    properties: { name: 'town' } as Record<string, unknown>,
  };
}

/** The GLB road mesh and every mesh drawn beside it. */
async function roadDraws(rawProperties: Record<string, string>): Promise<THREE.Mesh[]> {
  const fake = createFakeResourceLoader();
  fake.scenes.seed(GLB_PATH, GLB_SCENE);
  fake.glbMeshes.seed(GLB_PATH, glbWithRoad());
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack
      loader={fake.loader}
      scene={{
        internalResources: INTERNALS,
        externalResources: [{ id: 'glb_1', path: GLB_PATH, type: 'PackedScene' }],
      }}
    >
      <NodeDispatcher nodes={[townWithRoad(rawProperties)]} />
    </SceneStack>
  );
  const road = renderer.scene.findAllByType('Mesh').find((mesh) => mesh.instance.name === 'road')!
    .instance as THREE.Mesh;
  const beside = (road.parent?.children ?? []).filter(
    (sibling): sibling is THREE.Mesh => sibling !== road && sibling instanceof THREE.Mesh
  );
  return [road, ...beside];
}

/** The albedo of every mesh under the two-primitive road, after its override moves from red to green. */
async function twoPrimitiveRoadAlbedosAfterOverrideChange(): Promise<number[]> {
  const fake = createFakeResourceLoader();
  fake.scenes.seed(GLB_PATH, GLB_SCENE);
  fake.glbMeshes.seed(GLB_PATH, glbWithTwoPrimitiveRoad());
  const stack = (override: string) => (
    <SceneStack
      loader={fake.loader}
      scene={{
        internalResources: INTERNALS,
        externalResources: [{ id: 'glb_1', path: GLB_PATH, type: 'PackedScene' }],
      }}
    >
      <NodeDispatcher
        nodes={[
          townWithRoad({
            material_override: `SubResource("${override}")`,
            material_overlay: 'SubResource("Mat_blue_alpha")',
          }),
        ]}
      />
    </SceneStack>
  );
  const renderer = await ReactThreeTestRenderer.create(stack('Mat_red'));
  await renderer.update(stack('Mat_green'));
  const road = renderer.scene.findAll((node) => node.instance.name === 'road')[0]!.instance as THREE.Group;
  return road.children.map((child) => albedoOf(child as THREE.Mesh)).sort((a, b) => a - b);
}

/** The albedo of each primitive of the two-primitive road, in surface order. */
async function twoPrimitiveRoadAlbedos(rawProperties: Record<string, string>): Promise<number[]> {
  const fake = createFakeResourceLoader();
  fake.scenes.seed(GLB_PATH, GLB_SCENE);
  fake.glbMeshes.seed(GLB_PATH, glbWithTwoPrimitiveRoad());
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack
      loader={fake.loader}
      scene={{
        internalResources: INTERNALS,
        externalResources: [{ id: 'glb_1', path: GLB_PATH, type: 'PackedScene' }],
      }}
    >
      <NodeDispatcher nodes={[townWithRoad(rawProperties)]} />
    </SceneStack>
  );
  const road = renderer.scene.findAll((node) => node.instance.name === 'road')[0]!.instance as THREE.Group;
  return road.children.map((child) => albedoOf(child as THREE.Mesh));
}

function albedoOf(mesh: THREE.Mesh): number {
  return (mesh.material as THREE.MeshStandardMaterial).color.getHex();
}

describe('GLBSceneRoot: instance materials on a GLB mesh', () => {
  it('draws material_override in place of the glTF material', async () => {
    const [road, ...beside] = await roadDraws({ material_override: 'SubResource("Mat_red")' });

    expect(albedoOf(road!)).toBe(0xff0000);
    expect(beside).toEqual([]);
  });

  it('takes material_override in front of surface_material_override/0', async () => {
    const [road] = await roadDraws({
      'surface_material_override/0': 'SubResource("Mat_green")',
      material_override: 'SubResource("Mat_red")',
    });

    expect(albedoOf(road!)).toBe(0xff0000);
  });

  it('puts surface_material_override/N on surface N alone', async () => {
    expect(
      await twoPrimitiveRoadAlbedos({ 'surface_material_override/1': 'SubResource("Mat_green")' })
    ).toEqual([GLTF_COLOR, 0x00ff00]);
  });

  it('puts each surface override on its own surface', async () => {
    expect(
      await twoPrimitiveRoadAlbedos({
        'surface_material_override/0': 'SubResource("Mat_red")',
        'surface_material_override/1': 'SubResource("Mat_green")',
      })
    ).toEqual([0xff0000, 0x00ff00]);
  });

  it('keeps the surface override where material_override is null', async () => {
    const [road] = await roadDraws({
      'surface_material_override/0': 'SubResource("Mat_green")',
      material_override: 'null',
    });

    expect(albedoOf(road!)).toBe(0x00ff00);
  });

  it('draws material_overlay as one more draw of the road, over its own material', async () => {
    const [road, overlay, ...rest] = await roadDraws({ material_overlay: 'SubResource("Mat_blue_alpha")' });

    expect(albedoOf(road!)).toBe(GLTF_COLOR);
    expect(albedoOf(overlay!)).toBe(0x0000ff);
    expect(overlay!.geometry).toBe(road!.geometry);
    expect(rest).toEqual([]);
  });

  it('sorts an alpha-pass overlay before an alpha-pass surface, as Godot sorts the two', async () => {
    const [road, overlay] = await roadDraws({
      material_override: 'SubResource("Mat_blue_alpha")',
      material_overlay: 'SubResource("Mat_blue_alpha")',
    });

    expect(overlay!.renderOrder).toBeLessThan(road!.renderOrder);
  });

  it('draws an overlay that reads the stencil, as every other leaf draws its overlay', async () => {
    const [, overlay] = await roadDraws({ material_overlay: 'SubResource("Mat_stencil_reader")' });

    expect(albedoOf(overlay!)).toBe(0x00ffff);
  });

  it('sorts an overlay outside the alpha pass after the surface', async () => {
    const [road, overlay] = await roadDraws({ material_overlay: 'SubResource("Mat_green")' });

    expect(overlay!.renderOrder).toBeGreaterThan(road!.renderOrder);
  });

  it('draws the overlay over the override too', async () => {
    const [road, overlay] = await roadDraws({
      material_override: 'SubResource("Mat_red")',
      material_overlay: 'SubResource("Mat_blue_alpha")',
    });

    expect([albedoOf(road!), albedoOf(overlay!)]).toEqual([0xff0000, 0x0000ff]);
  });

  it('keeps the overlay on its own draws when the override of a road of two primitives changes', async () => {
    expect(await twoPrimitiveRoadAlbedosAfterOverrideChange()).toEqual([
      0x0000ff, 0x0000ff, 0x00ff00, 0x00ff00,
    ]);
  });
});
