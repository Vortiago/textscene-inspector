/**
 * `surface_material_override/N` on a mesh inside an instanced GLB, from an `ExtResource` `.tres`
 * or a `[sub_resource]` of the overriding scene. Godot treats both alike
 * (`MeshInstance3D::set_surface_override_material` takes a `Ref<Material>`).
 */
import { parseTresFile } from '../../../parser/parsedResource';
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
import { tagImportMaterial } from '../../../resources/formats/glb/glbProcessing';

import '../../nodes/index';

beforeAll(async () => {
  await initGlbModules();
});

const GLB_PATH = 'res://assets/town.glb';
const TRES_PATH = 'res://assets/road.tres';
const MISSING_TEXTURE_PATH = 'res://assets/missing.png';
/** The glTF's own material: what survives when an override is dropped. */
const GLTF_COLOR = 0x123456;

/** `importPath` tags the road's material as the GLB processor does for an import sidecar remap. */
function makeFakeGlb(importPath?: string): THREE.Object3D {
  const root = new THREE.Group();
  root.name = 'Scene';
  const material = new THREE.MeshStandardMaterial({ color: GLTF_COLOR });
  if (importPath) tagImportMaterial(material, importPath);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
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

/** The instancing node, with one override child carrying only a material, or none without a ref. */
function makeTownNode(materialRef: string | undefined): TscnNode {
  return {
    name: 'town',
    type: 'Node3D',
    instance: 'ExtResource("glb_1")',
    children:
      materialRef === undefined
        ? []
        : [
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

async function render(loader: ResourceLoader, materialRef: string | undefined) {
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
          {
            id: 'Mat_missing_texture',
            type: 'StandardMaterial3D',
            data: { albedo_texture: 'ExtResource("tex_missing")' },
          },
        ],
        externalResources: [
          { id: 'glb_1', path: GLB_PATH, type: 'PackedScene' },
          { id: 'tres_1', path: TRES_PATH, type: 'Material' },
          { id: 'tex_missing', path: MISSING_TEXTURE_PATH, type: 'Texture2D' },
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

function seeded(importPath?: string) {
  const fake = createFakeResourceLoader();
  fake.scenes.seed(GLB_PATH, makeSynthesisedGlbScene());
  fake.glbMeshes.seed(GLB_PATH, makeFakeGlb(importPath));
  return fake;
}

const RED_TRES =
  '[gd_resource type="StandardMaterial3D" format=3]\n\n[resource]\nalbedo_color = Color(1, 0, 0, 1)\n';

describe('GLBSceneRoot — surface_material_override on a GLB-internal mesh', () => {
  it('applies a material that arrived as an ExtResource .tres', async () => {
    const fake = seeded();
    fake.resources.seed(
      TRES_PATH,
      parseTresFile(
        '[gd_resource type="StandardMaterial3D" format=3]\n\n[resource]\nalbedo_color = Color(1, 0, 0, 1)\n'
      )
    );

    const renderer = await render(fake.loader, 'ExtResource("tres_1")');
    expect(roadMaterial(renderer).color.getHex()).toBe(0xff0000);
  });

  it('applies a material that arrived as a [sub_resource] of the scene', async () => {
    const renderer = await render(seeded().loader, 'SubResource("Mat_road")');

    const material = roadMaterial(renderer);
    // A dropped override leaves the glTF's own material, which looks deliberately authored.
    expect(material.color.getHex()).not.toBe(GLTF_COLOR);
    const linear = material.color.getRGB({ r: 0, g: 0, b: 0 } as THREE.Color, THREE.LinearSRGBColorSpace);
    expect(linear.g).toBeCloseTo(1, 5);
    expect(linear.r).toBeCloseTo(0, 5);
    expect(material.roughness).toBeCloseTo(0.25, 5);
  });

  it('keeps the glTF material while a .tres override still loads', async () => {
    const renderer = await render(seeded().loader, 'ExtResource("tres_1")');
    expect(roadMaterial(renderer).color.getHex()).toBe(GLTF_COLOR);
  });

  it('draws the magenta placeholder when the override names a texture that cannot load', async () => {
    const fake = seeded();
    fake.textures.seed(MISSING_TEXTURE_PATH, null);

    const renderer = await render(fake.loader, 'SubResource("Mat_missing_texture")');
    expect(roadMaterial(renderer).color.getHex()).toBe(0xff00ff);
  });

  it('leaves the glTF material alone when the reference names nothing', async () => {
    const renderer = await render(seeded().loader, 'SubResource("Mat_absent")');
    expect(roadMaterial(renderer).color.getHex()).toBe(GLTF_COLOR);
  });
});

/**
 * An import sidecar's material remap: the processor tags the surface with its `.tres`, and the
 * scene root draws that material through the one material path.
 */
describe('GLBSceneRoot — import sidecar material remap', () => {
  it('draws the .tres the sidecar remaps a surface to', async () => {
    const fake = seeded(TRES_PATH);
    fake.resources.seed(TRES_PATH, parseTresFile(RED_TRES));

    const renderer = await render(fake.loader, undefined);
    expect(roadMaterial(renderer).color.getHex()).toBe(0xff0000);
  });

  it('keeps the glTF material while the remapped .tres still loads', async () => {
    const renderer = await render(seeded(TRES_PATH).loader, undefined);
    expect(roadMaterial(renderer).color.getHex()).toBe(GLTF_COLOR);
  });

  it('lets a surface_material_override win over the sidecar remap', async () => {
    const fake = seeded(TRES_PATH);
    fake.resources.seed(TRES_PATH, parseTresFile(RED_TRES));

    const renderer = await render(fake.loader, 'SubResource("Mat_road")');
    const linear = roadMaterial(renderer).color.getRGB(
      { r: 0, g: 0, b: 0 } as THREE.Color,
      THREE.LinearSRGBColorSpace
    );
    expect(linear.g).toBeCloseTo(1, 5);
    expect(linear.r).toBeCloseTo(0, 5);
  });
});
