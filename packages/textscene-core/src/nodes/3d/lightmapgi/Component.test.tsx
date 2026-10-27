/** <LightmapGI> hands its baked data to the scene's lightmaps, which light the nodes it names. */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnParser } from '../../../parser/TscnParser';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { ShadowmaskMode } from '../../../godot/scene/lightmapGi';
import { dataArrayTexture } from '../../../resources/textures/dataArrayTexture';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { NodeTree } from '../../../r3f/testing/NodeTree';
import { lightmapsOf } from '../../../r3f/lightmap/sceneLightmaps';
import './index';
import './index.r3f';
import '../../base/node3d/index';
import '../../base/node3d/index.r3f';
import { settleLoads } from '../../../r3f/testing/settleLoads';
import { WorldEnvironmentScope } from '../../../r3f/environment/WorldEnvironmentScope';
import { usePublishCameraAttributes } from '../../../r3f/environment/worldExposure';

const ATLAS_PATH = 'res://bake.exr';
const SHADOWMASK_PATH = 'res://bake_shadow.png';

/**
 * A scene whose LightmapGI holds data that names `../Floor` in slice 1, with `lightmapLines` on it
 * and `dataLines` in its data.
 */
function scene(lightmapLines: string, dataLines: string) {
  return new TscnParser().parse(
    `[gd_scene format=3]\n\n` +
      `[ext_resource type="CompressedTexture2DArray" path="${ATLAS_PATH}" id="1_atlas"]\n` +
      `[ext_resource type="CompressedTexture2DArray" path="${SHADOWMASK_PATH}" id="2_mask"]\n\n` +
      `[sub_resource type="LightmapGIData" id="Data_1"]\n` +
      `lightmap_textures = [ExtResource("1_atlas")]\n` +
      dataLines +
      `user_data = [NodePath("../Floor"), Rect2(0.25, 0, 0.5, 0.5), 1, -1]\n\n` +
      `[node name="Root" type="Node3D"]\n\n` +
      `[node name="Floor" type="Node3D" parent="."]\n\n` +
      `[node name="Lightmap" type="LightmapGI" parent="."]\nlight_data = SubResource("Data_1")\n${lightmapLines}`
  );
}

/** Probe data with no points, which still carries the exposure the bake ran at. */
const bakedAt = (exposure: number) =>
  `probe_data = {\n"bounds": AABB(0, 0, 0, 0, 0, 0), "points": PackedVector3Array(), "tetrahedra": PackedInt32Array(), ` +
  `"bsp": PackedInt32Array(), "sh": PackedColorArray(), "interior": false, "baked_exposure": ${exposure}\n}\n`;

function PublishedExposure({ multiplier }: { multiplier: number }) {
  usePublishCameraAttributes({ status: 'resolved', attributes: { exposureMultiplier: multiplier } });
  return null;
}

interface Bake {
  atlas: THREE.DataArrayTexture | null;
  /** Undefined for a bake that saved no shadowmask, null for one whose texture is missing. */
  shadowmask?: THREE.DataArrayTexture | null;
  lightmapLines?: string;
  /** The `exposure_multiplier` of the world's camera attributes, or none. */
  exposureMultiplier?: number;
  /** The exposure the bake ran at, in the data's `probe_data`. */
  bakedExposure?: number;
}

async function mount({ atlas, shadowmask, lightmapLines = '', exposureMultiplier, bakedExposure }: Bake) {
  const fake = createFakeResourceLoader();
  if (atlas) fake.textureArrays.seed(ATLAS_PATH, atlas);
  if (shadowmask) fake.textureArrays.seed(SHADOWMASK_PATH, shadowmask);
  const dataLines =
    (shadowmask === undefined ? '' : `shadowmask_textures = [ExtResource("2_mask")]\n`) +
    (bakedExposure === undefined ? '' : bakedAt(bakedExposure));
  const parsed = scene(lightmapLines, dataLines);
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack loader={fake.loader} scene={parsed}>
      <WorldEnvironmentScope world="root">
        {exposureMultiplier !== undefined && <PublishedExposure multiplier={exposureMultiplier} />}
        <NodeTree node={parsed.nodes[0]!} path="Root" />
      </WorldEnvironmentScope>
    </SceneStack>
  );
  await settleLoads();
  const lightmaps = lightmapsOf(renderer.scene.instance as unknown as THREE.Scene);
  return { renderer, lightmaps };
}

const oneLayer = () => dataArrayTexture(new Uint16Array(4), 1, 1, 1);
const oneMaskLayer = () => dataArrayTexture(new Uint8Array(1), 1, 1, 1);

describe('<LightmapGI> exposure', () => {
  const exposureScaleOf = async (bake: Bake) =>
    (await mount(bake)).lightmaps.assignmentFor('Root/Floor')?.lightmap.exposureScale;

  it('reads the atlas at the world exposure over the exposure the bake ran at', async () => {
    expect(await exposureScaleOf({ atlas: oneLayer(), exposureMultiplier: 2, bakedExposure: 4 })).toBe(0.5);
  });

  it('reads the atlas at the world exposure when the bake ran at 1', async () => {
    expect(await exposureScaleOf({ atlas: oneLayer(), exposureMultiplier: 3 })).toBe(3);
  });

  it('reads the atlas at 1 without camera attributes, whatever the bake ran at (:1222-1227)', async () => {
    expect(await exposureScaleOf({ atlas: oneLayer(), bakedExposure: 4 })).toBe(1);
  });
});

describe('<LightmapGI>', () => {
  it('assigns each node its data names its rect and slice', async () => {
    const { lightmaps } = await mount({ atlas: oneLayer() });
    expect(lightmaps.assignmentFor('Root/Floor')?.user).toMatchObject({
      uvScale: { x: 0.25, y: 0, width: 0.5, height: 0.5 },
      sliceIndex: 1,
    });
  });

  it('draws from the atlas its lightmap texture loads', async () => {
    const atlas = oneLayer();
    const { lightmaps } = await mount({ atlas });
    expect(lightmaps.assignmentFor('Root/Floor')?.lightmap.atlas).toBe(atlas);
  });

  it('holds no atlas while its lightmap texture is missing (error case)', async () => {
    const { lightmaps } = await mount({ atlas: null });
    expect(lightmaps.assignmentFor('Root/Floor')?.lightmap.atlas).toBeNull();
  });

  it('holds the shadowmask in the alpha of the atlas, with the light unchanged', async () => {
    const atlas = dataArrayTexture(new Uint16Array([5, 6, 7, 8]), 1, 1, 1);
    const shadowmask = dataArrayTexture(new Uint8Array([51]), 1, 1, 1);
    const { lightmaps } = await mount({ atlas, shadowmask, lightmapLines: 'shadowmask_mode = 1\n' });
    const drawn = lightmaps.assignmentFor('Root/Floor')!.lightmap.atlas!;
    expect(drawn).not.toBe(atlas);
    expect([...(drawn.image.data as Uint16Array)]).toEqual([5, 6, 7, THREE.DataUtils.toHalfFloat(51 / 255)]);
  });

  it('draws from the lightmap texture itself in mode None, which never reads the shadowmask', async () => {
    const atlas = oneLayer();
    const { lightmaps } = await mount({ atlas, shadowmask: oneMaskLayer() });
    expect(lightmaps.assignmentFor('Root/Floor')?.lightmap.atlas).toBe(atlas);
  });

  it('draws from the lightmap texture itself for a bake that saved no shadowmask (edge case)', async () => {
    const atlas = oneLayer();
    const { lightmaps } = await mount({ atlas });
    expect(lightmaps.assignmentFor('Root/Floor')?.lightmap.atlas).toBe(atlas);
  });

  it('draws from the lightmap texture itself while the shadowmask texture is missing (error case)', async () => {
    const atlas = oneLayer();
    const { lightmaps } = await mount({ atlas, shadowmask: null });
    expect(lightmaps.assignmentFor('Root/Floor')?.lightmap.atlas).toBe(atlas);
  });

  it('takes the shadowmask mode from the node, not from the data', async () => {
    const { lightmaps } = await mount({
      atlas: oneLayer(),
      shadowmask: oneMaskLayer(),
      lightmapLines: 'shadowmask_mode = 2\n',
    });
    expect(lightmaps.assignmentFor('Root/Floor')?.lightmap.shadowmaskMode).toBe(ShadowmaskMode.OVERLAY);
  });

  it('applies no shadowmask mode to a bake that saved none, which Godot binds a white array for', async () => {
    const { lightmaps } = await mount({
      atlas: oneLayer(),
      shadowmask: null,
      lightmapLines: 'shadowmask_mode = 1\n',
    });
    expect(lightmaps.assignmentFor('Root/Floor')?.lightmap.shadowmaskMode).toBe(ShadowmaskMode.NONE);
  });

  it('assigns nothing once it leaves the scene (edge case)', async () => {
    const { renderer, lightmaps } = await mount({ atlas: oneLayer() });
    await ReactThreeTestRenderer.act(async () => {
      await renderer.unmount();
    });
    expect(lightmaps.assignmentFor('Root/Floor')).toBeNull();
  });
});
