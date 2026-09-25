/**
 * `surface_material_override/N` on a mesh inside an instanced GLB, from an `ExtResource` `.tres`
 * or a `[sub_resource]` of the overriding scene. Godot treats both alike
 * (`MeshInstance3D::set_surface_override_material` takes a `Ref<Material>`).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode, TscnScene } from '../../../parser/types';
import { NodeDispatcher } from '../../NodeDispatcher';
import { SceneStack } from '../../testing/SceneStack';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type { ResourceLoader } from '../../../resources/ResourceLoader';
import { GLB_SCENE_ROOT_TYPE } from './Component';
import { initGlbModules } from '../../../resources/processing/glbProcessing';

import '../../nodes/index';

beforeAll(async () => {
  await initGlbModules();
});

const GLB_PATH = 'res://assets/town.glb';
const TRES_PATH = 'res://assets/road.tres';
/** The glTF's own material: what survives when an override is dropped. */
const GLTF_COLOR = 0x123456;

function makeFakeGlb(): THREE.Object3D {
  const root = new THREE.Group();
  root.name = 'Scene';
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: GLTF_COLOR })
  );
  mesh.name = 'road';
  root.add(mesh);
  return root;
}

function makeSynthesisedGlbScene(): TscnScene {
  return {
    nodes: [
      {
        name: 'town',
        type: GLB_SCENE_ROOT_TYPE,
        children: [],
        properties: { glbPath: GLB_PATH } as Record<string, unknown>,
      },
    ],
    externalResources: [],
    internalResources: [],
  };
}

/** The instancing node, with one override child carrying only a material. */
function makeTownNode(materialRef: string): TscnNode {
  return {
    name: 'town',
    type: 'Node3D',
    instance: 'ExtResource("glb_1")',
    children: [
      {
        name: 'road',
        type: 'Node',
        children: [],
        overridesExistingNode: true,
        rawProperties: { 'surface_material_override/0': materialRef },
        properties: { name: 'road' } as Record<string, unknown>,
      },
    ],
    properties: { name: 'town' } as Record<string, unknown>,
  };
}

async function render(loader: ResourceLoader, materialRef: string) {
  return ReactThreeTestRenderer.create(
    <SceneStack
      loader={loader}
      scene={{
        internalResources: [
          {
            id: 'Mat_road',
            type: 'StandardMaterial3D',
            data: { albedo_color: 'Color(0, 1, 0, 1)', roughness: '0.25' },
          },
        ],
        externalResources: [
          { id: 'glb_1', path: GLB_PATH, type: 'PackedScene' },
          { id: 'tres_1', path: TRES_PATH, type: 'Material' },
        ],
      }}
    >
      <NodeDispatcher nodes={[makeTownNode(materialRef)]} />
    </SceneStack>
  );
}

function roadMaterial(
  renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>
): THREE.MeshStandardMaterial {
  const mesh = renderer.scene.findAllByType('Mesh').find((m) => m.instance.name === 'road');
  expect(mesh, 'the GLB road mesh should be rendered').toBeDefined();
  return (mesh!.instance as THREE.Mesh).material as THREE.MeshStandardMaterial;
}

function seeded() {
  const fake = createFakeResourceLoader();
  fake.scenes.seed(GLB_PATH, makeSynthesisedGlbScene());
  fake.glbMeshes.seed(GLB_PATH, makeFakeGlb());
  return fake;
}

describe('GLBSceneRoot — surface_material_override on a GLB-internal mesh', () => {
  it('applies a material that arrived as an ExtResource .tres', async () => {
    const fake = seeded();
    const loaded = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    fake.materials.seed(TRES_PATH, loaded);

    const renderer = await render(fake.loader, 'ExtResource("tres_1")');
    expect(roadMaterial(renderer)).toBe(loaded);
  });

  it('applies a material that arrived as a [sub_resource] of the scene', async () => {
    const renderer = await render(seeded().loader, 'SubResource("Mat_road")');

    const material = roadMaterial(renderer);
    // A dropped override leaves the glTF's own material, which looks deliberately authored.
    expect(material.color.getHex()).not.toBe(GLTF_COLOR);
    const linear = material.color.getRGB(
      { r: 0, g: 0, b: 0 } as THREE.Color,
      THREE.LinearSRGBColorSpace
    );
    expect(linear.g).toBeCloseTo(1, 5);
    expect(linear.r).toBeCloseTo(0, 5);
    expect(material.roughness).toBeCloseTo(0.25, 5);
  });

  it('leaves the glTF material alone when the reference names nothing', async () => {
    const renderer = await render(seeded().loader, 'SubResource("Mat_absent")');
    expect(roadMaterial(renderer).color.getHex()).toBe(GLTF_COLOR);
  });
});
