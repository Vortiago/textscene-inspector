/**
 * A `surface_material_override/N` whose material carries a `next_pass` chain, on a mesh
 * inside a loaded GLB: the links build through the imperative adapter, each mounted as
 * a sibling `THREE.Mesh` beside the target with the target's geometry, and the tree is
 * restored when the override goes away.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnInternalResource, TscnNode, TscnScene } from '../../../parser/types';
import { NodeDispatcher } from '../../NodeDispatcher';
import { SceneStack } from '../../testing/SceneStack';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { GLB_SCENE_ROOT_TYPE } from '../../../resources/glbSceneRoot';
import { INSTANTIABLE_SCENE } from '../../../parser/sceneDefaults.testkit';
import { nextPassRenderOrder } from '../../materials/nextPass';
import { parseTresFile } from '../../../parser/parsedResource';
import { tagImportMaterial } from '../../../resources/formats/glb/glbProcessing';

import '../../nodes/index';

const GLB_PATH = 'res://assets/town.glb';
const TRES_PATH = 'res://assets/road.tres';
const GLTF_COLOR = 0x123456;

/** The remapped `.tres` the sidecar names, with one inline `next_pass` link. */
const REMAP_TRES =
  '[gd_resource type="StandardMaterial3D" format=3]\n\n' +
  '[sub_resource type="StandardMaterial3D" id="Link"]\nalbedo_color = Color(0, 0, 1, 1)\n\n' +
  '[resource]\nalbedo_color = Color(1, 0, 0, 1)\nnext_pass = SubResource("Link")\n';

/** The GLB's own mesh: one box with one material, named `road`. */
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
}

function makeTownNode(materialRef: string | undefined): TscnNode {
  return {
    rawProperties: {},
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

async function render(materialRef: string) {
  const fake = createFakeResourceLoader();
  fake.scenes.seed(GLB_PATH, makeSynthesisedGlbScene());
  fake.glbMeshes.seed(GLB_PATH, makeFakeGlb());
  const scene: Pick<TscnScene, 'internalResources' | 'externalResources'> = {
    internalResources: [
      {
        id: 'Mat_road',
        type: 'StandardMaterial3D',
        data: { albedo_color: 'Color(1, 0, 0, 1)', next_pass: 'SubResource("Mat_link")' },
      },
      { id: 'Mat_plain', type: 'StandardMaterial3D', data: { albedo_color: 'Color(1, 0, 0, 1)' } },
      { id: 'Mat_link', type: 'StandardMaterial3D', data: { albedo_color: 'Color(0, 0, 1, 1)' } },
    ] as TscnInternalResource[],
    externalResources: [{ id: 'glb_1', path: GLB_PATH, type: 'PackedScene' }],
  };
  const treeWith = (ref: string) => (
    <SceneStack scene={scene} loader={fake.loader}>
      <NodeDispatcher nodes={[makeTownNode(ref)]} />
    </SceneStack>
  );
  return { renderer: await ReactThreeTestRenderer.create(treeWith(materialRef)), treeWith };
}

/** The GLB road mesh, and every mesh mounted beside it. */
function roadOf(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>): THREE.Mesh {
  const mesh = renderer.scene.findAllByType('Mesh').find((m) => m.instance.name === 'road');
  expect(mesh, 'the GLB road mesh should be rendered').toBeDefined();
  return mesh!.instance as THREE.Mesh;
}

function chainOf(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>): THREE.Mesh[] {
  const road = roadOf(renderer);
  const chain: THREE.Mesh[] = [];
  for (const sibling of road.parent?.children ?? []) {
    if (sibling !== road && sibling instanceof THREE.Mesh) chain.push(sibling);
  }
  return chain;
}

describe("GlbSurfaceMaterialOverride — the override material's next_pass chain", () => {
  it('mounts the chain link as a sibling mesh of the target, with its geometry', async () => {
    const renderer = (await render('SubResource("Mat_road")')).renderer;
    const road = roadOf(renderer);

    const chain = chainOf(renderer);
    expect(chain).toHaveLength(1);
    const [link] = chain;
    expect(link!.geometry).toBe(road.geometry);
    expect(link!.renderOrder).toBe(nextPassRenderOrder(1));
    const material = Array.isArray(link!.material) ? link!.material[0]! : link!.material;
    expect((material as THREE.MeshStandardMaterial).color.getHex()).toBe(0x0000ff);
  });

  it('mounts nothing for a material with no chain (edge case)', async () => {
    const renderer = (await render('SubResource("Mat_plain")')).renderer;
    expect(roadOf(renderer).material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(chainOf(renderer)).toHaveLength(0);
  });

  it('unmounts the chain when the override names nothing again', async () => {
    const { renderer, treeWith } = await render('SubResource("Mat_road")');
    expect(chainOf(renderer)).toHaveLength(1);

    // The GLB clone is long-lived, so a dropped override must leave the tree as it was.
    await renderer.update(treeWith('SubResource("Mat_plain")'));
    expect(chainOf(renderer)).toHaveLength(0);
  });

  it('mounts the chain of an import sidecar remap, whose link resolves in the remap .tres', async () => {
    const fake = createFakeResourceLoader();
    fake.scenes.seed(GLB_PATH, makeSynthesisedGlbScene());
    fake.glbMeshes.seed(GLB_PATH, makeFakeGlb(TRES_PATH));
    fake.resources.seed(TRES_PATH, parseTresFile(REMAP_TRES));
    const scene: Pick<TscnScene, 'internalResources' | 'externalResources'> = {
      internalResources: [],
      externalResources: [{ id: 'glb_1', path: GLB_PATH, type: 'PackedScene' }],
    };
    const renderer = await ReactThreeTestRenderer.create(
      <SceneStack scene={scene} loader={fake.loader}>
        <NodeDispatcher nodes={[makeTownNode(undefined)]} />
      </SceneStack>
    );

    // The remap drew the road, so its chain's sibling draws beside it.
    const road = roadOf(renderer);
    expect((road.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0xff0000);
    const chain = chainOf(renderer);
    expect(chain).toHaveLength(1);
    expect(chain[0]!.geometry).toBe(road.geometry);
    const linkMaterial = Array.isArray(chain[0]!.material) ? chain[0]!.material[0]! : chain[0]!.material;
    expect((linkMaterial as THREE.MeshStandardMaterial).color.getHex()).toBe(0x0000ff);
  });
});
