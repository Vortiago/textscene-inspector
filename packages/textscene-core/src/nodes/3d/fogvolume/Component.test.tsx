/**
 * <FogVolume> puts a fog volume into its scene for the volumetric fog to draw: its shape, its size
 * and what fills it, at the node's transform.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { FogVolumeShape } from '../../../godot/rendering/environment/fogVolume';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../parser/types';
import { FogVolumeObject } from '../../../r3f/fog/fogVolumeObject';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { FogVolume } from './Component';
import { parseFogVolume } from './parser';

const FOG_MATERIAL: TscnInternalResource = {
  id: 'FogMaterial_1',
  type: 'FogMaterial',
  data: { density: '-2' },
};
const SHADER_MATERIAL: TscnInternalResource = { id: 'ShaderMaterial_1', type: 'ShaderMaterial', data: {} };
const NOISE: TscnInternalResource = { id: 'FastNoiseLite_1', type: 'FastNoiseLite', data: {} };
const NOISE_TEXTURE: TscnInternalResource = {
  id: 'NoiseTexture3D_1',
  type: 'NoiseTexture3D',
  data: { noise: 'SubResource("FastNoiseLite_1")', width: '4', height: '3', depth: '2' },
};
const TEXTURED_MATERIAL: TscnInternalResource = {
  id: 'FogMaterial_2',
  type: 'FogMaterial',
  data: { density_texture: 'SubResource("NoiseTexture3D_1")' },
};
const IMAGE_MATERIAL: TscnInternalResource = {
  id: 'FogMaterial_3',
  type: 'FogMaterial',
  data: { density_texture: 'ExtResource("1_density")' },
};
const RESOURCES = [FOG_MATERIAL, SHADER_MATERIAL, NOISE, NOISE_TEXTURE, TEXTURED_MATERIAL, IMAGE_MATERIAL];
const IMAGE_PATH = 'res://fog/density.png';
const EXTERNAL_RESOURCES: TscnExternalResource[] = [
  { id: '1_density', type: 'CompressedTexture3D', path: IMAGE_PATH },
];
/** The imported 3D texture the loader holds for `IMAGE_PATH`. */
const IMPORTED = new THREE.Data3DTexture(new Uint8Array(32), 2, 2, 2);

function fogVolumeNode(props: Record<string, string>): TscnNode {
  return {
    rawProperties: {},
    name: 'Fog',
    type: 'FogVolume',
    children: [],
    properties: parseFogVolume({ type: 'node', attributes: { type: 'FogVolume', name: 'Fog' } }, props),
  };
}

/** The fog volume a FogVolume node with `props` puts into its scene. */
async function mountedVolume(props: Record<string, string>): Promise<FogVolumeObject> {
  const fake = createFakeResourceLoader();
  fake.textures3D.seed(IMAGE_PATH, IMPORTED);
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={RESOURCES} externalResources={EXTERNAL_RESOURCES}>
        <NodePathProvider path="Fog">
          <FogVolume node={fogVolumeNode(props)} />
        </NodePathProvider>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  // Lets the density texture's build land.
  await ReactThreeTestRenderer.act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  const volumes: FogVolumeObject[] = [];
  renderer.scene.instance.traverse((object) => {
    if (object instanceof FogVolumeObject) volumes.push(object);
  });
  expect(volumes).toHaveLength(1);
  return volumes[0]!;
}

describe('<FogVolume>', () => {
  it('puts its shape and size into the scene', async () => {
    const volume = await mountedVolume({ shape: '0', size: 'Vector3(4, 3, 4)' });
    expect(volume.shape).toBe(FogVolumeShape.ELLIPSOID);
    expect(volume.size.toArray()).toEqual([4, 3, 4]);
  });

  it('fills the volume with its FogMaterial', async () => {
    const volume = await mountedVolume({ material: 'SubResource("FogMaterial_1")' });
    expect(volume.fill).toMatchObject({ kind: 'material', material: { density: -2 } });
  });

  it('fills a FogMaterial volume with its NoiseTexture3D once built', async () => {
    const volume = await mountedVolume({ material: 'SubResource("FogMaterial_2")' });
    expect(volume.fill.kind === 'material' && volume.fill.densityTexture).toBeInstanceOf(THREE.Data3DTexture);
  });

  it('fills a FogMaterial volume with its imported 3D texture', async () => {
    const volume = await mountedVolume({ material: 'SubResource("FogMaterial_3")' });
    expect(volume.fill).toMatchObject({ densityTexture: IMPORTED });
  });

  it('leaves the density texture empty for a FogMaterial without one', async () => {
    const volume = await mountedVolume({ material: 'SubResource("FogMaterial_1")' });
    expect(volume.fill).toMatchObject({ densityTexture: null });
  });

  it("fills a volume without a material with Godot's default fog", async () => {
    expect((await mountedVolume({})).fill).toEqual({ kind: 'default' });
  });

  it('marks a ShaderMaterial fill as a fog shader the previewer does not run (edge case)', async () => {
    const volume = await mountedVolume({ material: 'SubResource("ShaderMaterial_1")' });
    expect(volume.fill).toEqual({ kind: 'shader' });
  });

  it("fills the volume with Godot's default fog when its material is missing (error case)", async () => {
    expect((await mountedVolume({ material: 'SubResource("Missing")' })).fill).toEqual({ kind: 'default' });
  });
});
