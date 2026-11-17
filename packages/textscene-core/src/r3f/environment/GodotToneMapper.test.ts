import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { textureView } from '../../resources/textures/textureView';
import { GLOW_MAP_SAMPLER, GodotToneMapper } from './GodotToneMapper';
import {
  FRAME_UNIFORM,
  GLOW_MAP_UNIFORM,
  RESOLUTION_UNIFORM,
} from '../../resources/environment/godotCompositor';
import { GLOW_TEXTURE_SIZE_UNIFORM, glowLevelUniform } from '../../resources/environment/godotGlowPyramid';
import { glowParamsFor } from '../../resources/environment/godotGlow';
import { decodeEnvironment } from '../../resources/environment/decode';
import { createEnvironmentSettings } from '../../resources/environment/build';
import { ToneMapper } from '../../godot/rendering/environment/toneMapping.js';
import { DEFAULT_CLEAR_COLOR } from '../../godot/rendering/rendering';
import { LUMINANCE_UNIFORM } from '../../resources/environment/godotLuminance';
import type { AutoExposure } from '../../resources/cameraattributes/types';
import { testRenderer } from '../../testing/recordingWebGL';

const AUTO_EXPOSURE: AutoExposure = { scale: 0.4, minLuminance: 0, maxLuminance: 1 };

function toneMapperWith(properties: Record<string, string>, autoExposure: AutoExposure | null = null) {
  const settings = createEnvironmentSettings(
    decodeEnvironment({ glow_enabled: 'true', ...properties }),
    DEFAULT_CLEAR_COLOR
  );
  return new GodotToneMapper({
    glow: glowParamsFor(settings),
    adjustments: null,
    autoExposure,
    toneMapping: { mode: ToneMapper.FILMIC, white: 1 },
    exposure: 1,
    transparentBackground: false,
    usesBicubicGlowUpscale: true,
    usesDebanding: false,
  });
}

function srgbTexture(): THREE.Texture {
  const texture = new THREE.DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function sampledMap(toneMapper: GodotToneMapper): THREE.Texture {
  return toneMapper.uniforms[GLOW_MAP_UNIFORM]!.value as THREE.Texture;
}

const MAP = { glow_map: 'SubResource("Gradient_1")' };

describe('GLOW_MAP_SAMPLER', () => {
  it('samples the raw texels, clamped, without touching the shared texture', () => {
    const shared = srgbTexture();
    const view = textureView(shared, GLOW_MAP_SAMPLER);
    expect(view.colorSpace).toBe(THREE.NoColorSpace);
    expect(view.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(shared.colorSpace).toBe(THREE.SRGBColorSpace);
  });
});

describe('GodotToneMapper.setGlowMap', () => {
  it('samples the map it is given', () => {
    const toneMapper = toneMapperWith(MAP);
    const map = srgbTexture();
    toneMapper.setGlowMap(map);
    expect(sampledMap(toneMapper)).toBe(map);
  });

  it('samples white after clearGlowMap, which leaves the glow unscaled', () => {
    const toneMapper = toneMapperWith(MAP);
    toneMapper.setGlowMap(srgbTexture());
    toneMapper.clearGlowMap();
    expect(Array.from((sampledMap(toneMapper) as THREE.DataTexture).image.data as Uint8Array)).toEqual([
      255, 255, 255, 255,
    ]);
  });

  it('samples white from construction, before any map arrives', () => {
    expect(
      Array.from((sampledMap(toneMapperWith(MAP)) as THREE.DataTexture).image.data as Uint8Array)
    ).toEqual([255, 255, 255, 255]);
  });

  it('binds no map when the environment names none (edge case)', () => {
    const toneMapper = toneMapperWith({});
    toneMapper.setGlowMap(srgbTexture());
    expect(GLOW_MAP_UNIFORM in toneMapper.uniforms).toBe(false);
  });
});

describe('GodotToneMapper glow levels', () => {
  const sizeOfLevel = (toneMapper: GodotToneMapper, level: number) => {
    const { image } = toneMapper.uniforms[glowLevelUniform(level)]!.value as THREE.Texture<{
      width: number;
      height: number;
    }>;
    return [image.width, image.height];
  };

  it('binds each gathered level to its own texture, one mip below the one before', () => {
    const toneMapper = toneMapperWith({});
    toneMapper.setSize(800, 600);
    expect(sizeOfLevel(toneMapper, 1)).toEqual([200, 150]);
    expect(sizeOfLevel(toneMapper, 2)).toEqual([100, 75]);
    expect(sizeOfLevel(toneMapper, 3)).toEqual([50, 37]);
  });

  it('binds no level the weights leave out', () => {
    const toneMapper = toneMapperWith({});
    expect(glowLevelUniform(0) in toneMapper.uniforms).toBe(false);
    expect(glowLevelUniform(4) in toneMapper.uniforms).toBe(false);
  });

  const DEEPEST = { 'glow_levels/7': '0.5' };

  it('reads the deepest level of a full-size frame from its own texture', () => {
    const toneMapper = toneMapperWith(DEEPEST);
    toneMapper.setSize(800, 600);
    expect(sizeOfLevel(toneMapper, 6)).toEqual([6, 4]);
  });

  it('reads a level the small frame has no mip for from the last level it has, as textureLod clamps', () => {
    // 200x100 has levels 0 to 5 (`glowLevelCap`), so level 6 reads level 5: 100x50 >> 5.
    const toneMapper = toneMapperWith(DEEPEST);
    toneMapper.setSize(200, 100);
    expect(sizeOfLevel(toneMapper, 6)).toEqual([3, 1]);
  });

  it('reads a level from its own texture again once the frame grows back', () => {
    const toneMapper = toneMapperWith(DEEPEST);
    toneMapper.setSize(200, 100);
    toneMapper.setSize(800, 600);
    expect(sizeOfLevel(toneMapper, 6)).toEqual([6, 4]);
  });
});

describe('GodotToneMapper glow texture size', () => {
  const textureSize = (toneMapper: GodotToneMapper) =>
    (toneMapper.uniforms[GLOW_TEXTURE_SIZE_UNIFORM]!.value as THREE.Vector2).toArray();

  it('is the half-size glow texture, which the bicubic read halves again for each level', () => {
    const toneMapper = toneMapperWith({});
    toneMapper.setSize(800, 600);
    expect(textureSize(toneMapper)).toEqual([400, 300]);
  });

  it('follows a resize', () => {
    const toneMapper = toneMapperWith({});
    toneMapper.setSize(800, 600);
    toneMapper.setSize(201, 101);
    expect(textureSize(toneMapper)).toEqual([100, 50]);
  });
});

describe('GodotToneMapper auto exposure', () => {
  const luminanceOf = (toneMapper: GodotToneMapper) => toneMapper.uniforms[LUMINANCE_UNIFORM]?.value;

  it('samples a luminance texture from construction, which the reduction fills for each frame', () => {
    expect(luminanceOf(toneMapperWith({}, AUTO_EXPOSURE))).toBeInstanceOf(THREE.Texture);
  });

  it('samples none without an auto exposure', () => {
    expect(luminanceOf(toneMapperWith({}))).toBeUndefined();
  });

  it('reduces the frame before it builds the glow, which reads the luminance (renderer_scene_render_rd.cpp:551-607)', async () => {
    const { renderer } = await testRenderer();
    const toneMapper = toneMapperWith({}, AUTO_EXPOSURE);
    const drawn: THREE.ShaderMaterial[] = [];
    vi.spyOn(renderer, 'render').mockImplementation((quad) => {
      drawn.push((quad as THREE.Mesh).material as THREE.ShaderMaterial);
    });
    toneMapper.setSize(64, 64);
    toneMapper.render(renderer, new THREE.WebGLRenderTarget(64, 64), null);
    const names = drawn.map(({ name }) => name.split('.')[0]);
    expect(names.indexOf('GodotGlow')).toBeGreaterThan(names.lastIndexOf('GodotLuminance'));
    expect(names).toContain('GodotLuminance');
  });

  it('gives the first glow level the luminance the composite samples', async () => {
    const { renderer } = await testRenderer();
    const toneMapper = toneMapperWith({}, AUTO_EXPOSURE);
    const drawn: THREE.ShaderMaterial[] = [];
    vi.spyOn(renderer, 'render').mockImplementation((quad) => {
      drawn.push((quad as THREE.Mesh).material as THREE.ShaderMaterial);
    });
    toneMapper.setSize(64, 64);
    toneMapper.render(renderer, new THREE.WebGLRenderTarget(64, 64), null);
    const brightPass = drawn.find(({ name }) => name === 'GodotGlow.FirstVertical')!;
    expect(brightPass.uniforms[LUMINANCE_UNIFORM]!.value).toBe(luminanceOf(toneMapper));
  });
});

describe('GodotToneMapper.render', () => {
  it('draws the composite last, into the target, reading the frame the world drew', async () => {
    const { renderer } = await testRenderer();
    const toneMapper = toneMapperWith({});
    const draws: { pass: THREE.ShaderMaterial; target: THREE.WebGLRenderTarget | null; frame: unknown }[] =
      [];
    vi.spyOn(renderer, 'render').mockImplementation((quad) => {
      const pass = (quad as THREE.Mesh).material as THREE.ShaderMaterial;
      draws.push({ pass, target: renderer.getRenderTarget(), frame: pass.uniforms[FRAME_UNIFORM]?.value });
    });
    const frame = new THREE.WebGLRenderTarget(64, 64);
    const target = new THREE.WebGLRenderTarget(64, 64);
    toneMapper.setSize(64, 64);
    toneMapper.render(renderer, frame, target);
    const last = draws.at(-1)!;
    expect(last.pass.name).toBe('GodotToneMap');
    expect(last.target).toBe(target);
    expect(last.frame).toBe(frame.texture);
  });

  it('gives the debanding dither the frame size, which flips the fragment row to the top-left origin', () => {
    const toneMapper = new GodotToneMapper({
      glow: null,
      adjustments: null,
      autoExposure: null,
      toneMapping: { mode: ToneMapper.FILMIC, white: 1 },
      exposure: 1,
      transparentBackground: false,
      usesBicubicGlowUpscale: true,
      usesDebanding: true,
    });
    toneMapper.setSize(320, 200);
    expect((toneMapper.uniforms[RESOLUTION_UNIFORM]!.value as THREE.Vector2).toArray()).toEqual([320, 200]);
  });
});
