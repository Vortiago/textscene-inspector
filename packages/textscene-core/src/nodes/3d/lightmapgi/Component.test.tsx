/** <LightmapGI> hands its baked data to the scene's lightmaps, which light the nodes it names. */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnParser } from '../../../parser/TscnParser';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { dataArrayTexture } from '../../../resources/textures/dataArrayTexture';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { NodeTree } from '../../../r3f/testing/NodeTree';
import { lightmapsOf } from '../../../r3f/lightmap/sceneLightmaps';
import './index';
import './index.r3f';
import '../../base/node3d/index';
import '../../base/node3d/index.r3f';
import { settleLoads } from '../../../r3f/testing/settleLoads';

const ATLAS_PATH = 'res://bake.exr';

/** A scene whose LightmapGI holds data that names `../Floor` in slice 1, with `lightmapLines` on it. */
function scene(lightmapLines = '') {
  return new TscnParser().parse(
    `[gd_scene format=3]\n\n` +
      `[ext_resource type="CompressedTexture2DArray" path="${ATLAS_PATH}" id="1_atlas"]\n\n` +
      `[sub_resource type="LightmapGIData" id="Data_1"]\n` +
      `lightmap_textures = [ExtResource("1_atlas")]\n` +
      `user_data = [NodePath("../Floor"), Rect2(0.25, 0, 0.5, 0.5), 1, -1]\n\n` +
      `[node name="Root" type="Node3D"]\n\n` +
      `[node name="Floor" type="Node3D" parent="."]\n\n` +
      `[node name="Lightmap" type="LightmapGI" parent="."]\nlight_data = SubResource("Data_1")\n${lightmapLines}`
  );
}

async function mount(atlas: THREE.DataArrayTexture | null, lightmapLines = '') {
  const fake = createFakeResourceLoader();
  if (atlas) fake.textureArrays.seed(ATLAS_PATH, atlas);
  const parsed = scene(lightmapLines);
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack loader={fake.loader} scene={parsed}>
      <NodeTree node={parsed.nodes[0]!} path="Root" />
    </SceneStack>
  );
  await settleLoads();
  const lightmaps = lightmapsOf(renderer.scene.instance as unknown as THREE.Scene);
  return { renderer, lightmaps };
}

const oneLayer = () => dataArrayTexture(new Uint16Array(4), 1, 1, 1);

describe('<LightmapGI>', () => {
  it('assigns each node its data names its rect and slice', async () => {
    const { lightmaps } = await mount(oneLayer());
    expect(lightmaps.assignmentFor('Root/Floor')?.user).toMatchObject({
      uvScale: { x: 0.25, y: 0, width: 0.5, height: 0.5 },
      sliceIndex: 1,
    });
  });

  it('draws from the atlas its lightmap texture loads', async () => {
    const atlas = oneLayer();
    const { lightmaps } = await mount(atlas);
    expect(lightmaps.assignmentFor('Root/Floor')?.lightmap.atlas).toBe(atlas);
  });

  it('holds no atlas while its lightmap texture is missing (error case)', async () => {
    const { lightmaps } = await mount(null);
    expect(lightmaps.assignmentFor('Root/Floor')?.lightmap.atlas).toBeNull();
  });

  it('assigns nothing once it leaves the scene (edge case)', async () => {
    const { renderer, lightmaps } = await mount(oneLayer());
    await ReactThreeTestRenderer.act(async () => {
      await renderer.unmount();
    });
    expect(lightmaps.assignmentFor('Root/Floor')).toBeNull();
  });
});
