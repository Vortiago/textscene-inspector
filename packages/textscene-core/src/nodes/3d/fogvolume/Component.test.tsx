/**
 * <FogVolume> puts a fog volume into its scene for the volumetric fog to draw: its shape, its size
 * and what fills it, at the node's transform.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { FogVolumeShape } from '../../../godot/rendering/environment/fogVolume';
import { setLogAdapter, type LogAdapter } from '../../../logger';
import { parseShaderFile } from '../../../parser/parsedResource';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../parser/types';
import { FogVolumeObject } from '../../../r3f/fog/fogVolumeObject';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { FogVolume } from './Component';
import { settleLoads } from '../../../r3f/testing/settleLoads';
import { parseFogVolume } from './parser';

const FOG_MATERIAL: TscnInternalResource = {
  id: 'FogMaterial_1',
  type: 'FogMaterial',
  data: { density: '-2' },
};
const FOG_SHADER: TscnInternalResource = {
  id: 'Shader_fog',
  type: 'Shader',
  data: { code: '"shader_type fog;\nvoid fog() { DENSITY = 0.5; }"' },
};
const SPATIAL_SHADER: TscnInternalResource = {
  id: 'Shader_spatial',
  type: 'Shader',
  data: { code: '"shader_type spatial;\nvoid fragment() {}"' },
};
const EMPTY_SHADER: TscnInternalResource = { id: 'Shader_empty', type: 'Shader', data: {} };
const FOG_VISUAL_SHADER: TscnInternalResource = {
  id: 'VisualShader_fog',
  type: 'VisualShader',
  data: { mode: '4' },
};
const SPATIAL_VISUAL_SHADER: TscnInternalResource = {
  id: 'VisualShader_spatial',
  type: 'VisualShader',
  data: {},
};
/** A ShaderMaterial with `shader` as its shader reference, or none. */
function shaderMaterial(id: string, shader?: string): TscnInternalResource {
  return { id, type: 'ShaderMaterial', data: shader ? { shader } : {} };
}
const SHADER_MATERIAL = shaderMaterial('ShaderMaterial_1');
const FOG_SHADER_MATERIAL = shaderMaterial('ShaderMaterial_fog', 'SubResource("Shader_fog")');
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
const RESOURCES = [
  FOG_MATERIAL,
  SHADER_MATERIAL,
  NOISE,
  NOISE_TEXTURE,
  TEXTURED_MATERIAL,
  IMAGE_MATERIAL,
  FOG_SHADER,
  SPATIAL_SHADER,
  FOG_SHADER_MATERIAL,
  shaderMaterial('ShaderMaterial_spatial', 'SubResource("Shader_spatial")'),
  shaderMaterial('ShaderMaterial_file', 'ExtResource("2_shader")'),
  shaderMaterial('ShaderMaterial_tres', 'ExtResource("3_shader")'),
  shaderMaterial('ShaderMaterial_spatial_file', 'ExtResource("4_shader")'),
  shaderMaterial('ShaderMaterial_unloaded', 'ExtResource("5_shader")'),
  shaderMaterial('ShaderMaterial_unreadable', 'ExtResource("6_shader")'),
  shaderMaterial('ShaderMaterial_null', 'null'),
  shaderMaterial('ShaderMaterial_missing', 'SubResource("Missing")'),
  EMPTY_SHADER,
  shaderMaterial('ShaderMaterial_empty', 'SubResource("Shader_empty")'),
  FOG_VISUAL_SHADER,
  shaderMaterial('ShaderMaterial_visual_fog', 'SubResource("VisualShader_fog")'),
  SPATIAL_VISUAL_SHADER,
  shaderMaterial('ShaderMaterial_visual_spatial', 'SubResource("VisualShader_spatial")'),
];
const IMAGE_PATH = 'res://fog/density.png';
const SPATIAL_SHADER_PATH = 'res://fog/spatial.tres';
const FOG_SHADER_FILE_PATH = 'res://fog/wisps.gdshader';
const SPATIAL_SHADER_FILE_PATH = 'res://fog/spatial.gdshader';
const UNREADABLE_SHADER_PATH = 'res://fog/unreadable.gdshader';
const EXTERNAL_RESOURCES: TscnExternalResource[] = [
  { id: '1_density', type: 'CompressedTexture3D', path: IMAGE_PATH },
  { id: '2_shader', type: 'Shader', path: FOG_SHADER_FILE_PATH },
  { id: '3_shader', type: 'Shader', path: SPATIAL_SHADER_PATH },
  { id: '4_shader', type: 'Shader', path: SPATIAL_SHADER_FILE_PATH },
  { id: '5_shader', type: 'Shader', path: 'res://fog/unloaded.gdshader' },
  { id: '6_shader', type: 'Shader', path: UNREADABLE_SHADER_PATH },
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
async function mountedVolume(
  props: Record<string, string>,
  resources: TscnInternalResource[] = RESOURCES
): Promise<FogVolumeObject> {
  const fake = createFakeResourceLoader();
  fake.textures3D.seed(IMAGE_PATH, IMPORTED);
  fake.resources.seed(SPATIAL_SHADER_PATH, {
    resourceType: 'Shader',
    properties: SPATIAL_SHADER.data,
    extResources: [],
    subResources: [],
  });
  fake.resources.seed(FOG_SHADER_FILE_PATH, parseShaderFile('shader_type fog;\nvoid fog() {}\n'));
  fake.resources.seed(SPATIAL_SHADER_FILE_PATH, parseShaderFile('shader_type spatial;\n'));
  fake.resources.seed(UNREADABLE_SHADER_PATH, null);
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={resources} externalResources={EXTERNAL_RESOURCES}>
        <NodePathProvider path="Fog">
          <FogVolume node={fogVolumeNode(props)} />
        </NodePathProvider>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  await settleLoads();
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

  it('marks a fog ShaderMaterial fill as a fog shader the previewer does not run', async () => {
    const volume = await mountedVolume({ material: 'SubResource("ShaderMaterial_fog")' });
    expect(volume.fill).toEqual({ kind: 'shader' });
  });

  it("fills a volume with a ShaderMaterial whose .tres shader is spatial with Godot's default fog", async () => {
    const volume = await mountedVolume({ material: 'SubResource("ShaderMaterial_tres")' });
    expect(volume.fill).toEqual({ kind: 'default' });
  });

  it('marks a ShaderMaterial whose .gdshader is a fog shader as a fog shader', async () => {
    const volume = await mountedVolume({ material: 'SubResource("ShaderMaterial_file")' });
    expect(volume.fill).toEqual({ kind: 'shader' });
  });

  it("fills a volume with a ShaderMaterial whose .gdshader is spatial with Godot's default fog", async () => {
    const volume = await mountedVolume({ material: 'SubResource("ShaderMaterial_spatial_file")' });
    expect(volume.fill).toEqual({ kind: 'default' });
  });

  it('marks a ShaderMaterial whose shader has not loaded as a fog shader (edge case)', async () => {
    const volume = await mountedVolume({ material: 'SubResource("ShaderMaterial_unloaded")' });
    expect(volume.fill).toEqual({ kind: 'shader' });
  });

  it("fills a volume with a ShaderMaterial whose shader does not load with Godot's default fog (error case)", async () => {
    const volume = await mountedVolume({ material: 'SubResource("ShaderMaterial_unreadable")' });
    expect(volume.fill).toEqual({ kind: 'default' });
  });

  it("fills a volume with a ShaderMaterial whose shader is null with Godot's default fog (edge case)", async () => {
    const volume = await mountedVolume({ material: 'SubResource("ShaderMaterial_null")' });
    expect(volume.fill).toEqual({ kind: 'default' });
  });

  it("fills a volume with a ShaderMaterial whose shader is missing with Godot's default fog (error case)", async () => {
    const volume = await mountedVolume({ material: 'SubResource("ShaderMaterial_missing")' });
    expect(volume.fill).toEqual({ kind: 'default' });
  });

  it("fills a volume with a ShaderMaterial without a shader with Godot's default fog (edge case)", async () => {
    const volume = await mountedVolume({ material: 'SubResource("ShaderMaterial_1")' });
    expect(volume.fill).toEqual({ kind: 'default' });
  });

  it("fills a volume with a spatial ShaderMaterial with Godot's default fog (error case)", async () => {
    const volume = await mountedVolume({ material: 'SubResource("ShaderMaterial_spatial")' });
    expect(volume.fill).toEqual({ kind: 'default' });
  });

  it("fills a volume with a ShaderMaterial whose shader has no code with Godot's default fog (edge case)", async () => {
    const volume = await mountedVolume({ material: 'SubResource("ShaderMaterial_empty")' });
    expect(volume.fill).toEqual({ kind: 'default' });
  });

  it('marks a ShaderMaterial whose VisualShader runs in fog mode as a fog shader', async () => {
    const volume = await mountedVolume({ material: 'SubResource("ShaderMaterial_visual_fog")' });
    expect(volume.fill).toEqual({ kind: 'shader' });
  });

  it("fills a volume with a ShaderMaterial whose VisualShader is spatial with Godot's default fog (edge case)", async () => {
    const volume = await mountedVolume({ material: 'SubResource("ShaderMaterial_visual_spatial")' });
    expect(volume.fill).toEqual({ kind: 'default' });
  });

  it("fills the volume with Godot's default fog when its material is missing (error case)", async () => {
    expect((await mountedVolume({ material: 'SubResource("Missing")' })).fill).toEqual({ kind: 'default' });
  });
});

describe('<FogVolume> with a shader it does not run', () => {
  afterEach(() => setLogAdapter(null));

  /** The `[FogVolume]` messages the logger receives at info level while `run` runs. */
  async function fogVolumeInfoMessages(run: () => Promise<unknown>): Promise<string[]> {
    const info = vi.fn();
    const adapter: LogAdapter = { trace: vi.fn(), debug: vi.fn(), info, warn: vi.fn(), error: vi.fn() };
    setLogAdapter(adapter);
    await run();
    return info.mock.calls
      .map(([message]) => String(message))
      .filter((message) => message.startsWith('[FogVolume]'));
  }

  it('logs once that it adds no fog for a fog shader', async () => {
    // A copy of the material, which the logger has not seen in an earlier test.
    const resources = [{ ...FOG_SHADER_MATERIAL }, FOG_SHADER];
    const props = { material: 'SubResource("ShaderMaterial_fog")' };
    const messages = await fogVolumeInfoMessages(async () => {
      await mountedVolume(props, resources);
      await mountedVolume(props, resources);
    });
    expect(messages).toHaveLength(1);
  });

  it('logs nothing for a spatial shader, which Godot also fills with its default fog (edge case)', async () => {
    const props = { material: 'SubResource("ShaderMaterial_spatial")' };
    expect(await fogVolumeInfoMessages(() => mountedVolume(props))).toEqual([]);
  });
});
