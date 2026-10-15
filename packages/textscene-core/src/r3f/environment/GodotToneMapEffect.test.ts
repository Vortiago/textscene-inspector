/**
 * The glow map as the composite samples it: Godot binds the texture's non-sRGB view, clamped
 * (`renderer_scene_render_rd.cpp:707`, `tone_mapper.cpp:177`).
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GodotToneMapEffect, glowMapView } from './GodotToneMapEffect';
import { GLOW_MAP_UNIFORM } from '../../resources/environment/godotCompositor';
import { glowParamsFor } from '../../resources/environment/godotGlow';
import { decodeEnvironment } from '../../resources/environment/decode';
import { createEnvironmentSettings } from '../../resources/environment/build';
import { ToneMapper } from '../../godot/rendering/environment/toneMapping.js';
import { DEFAULT_CLEAR_COLOR } from '../../godot/rendering/rendering';

function effectWith(properties: Record<string, string>) {
  const settings = createEnvironmentSettings(
    decodeEnvironment({ glow_enabled: 'true', ...properties }),
    DEFAULT_CLEAR_COLOR
  );
  return new GodotToneMapEffect({
    glow: glowParamsFor(settings),
    adjustments: null,
    toneMapping: { mode: ToneMapper.FILMIC, white: 1 },
    exposure: 1,
  });
}

function srgbTexture(): THREE.Texture {
  const texture = new THREE.DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function sampledMap(effect: GodotToneMapEffect): THREE.Texture {
  return effect.uniforms.get(GLOW_MAP_UNIFORM)!.value as THREE.Texture;
}

const MAP = { glow_map: 'SubResource("Gradient_1")' };

describe('glowMapView', () => {
  it('samples the raw texels, clamped, without touching the shared texture', () => {
    const shared = srgbTexture();
    const view = glowMapView(shared);
    expect(view.colorSpace).toBe(THREE.NoColorSpace);
    expect(view.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(shared.colorSpace).toBe(THREE.SRGBColorSpace);
  });
});

describe('GodotToneMapEffect.setGlowMap', () => {
  it('samples the map it is given', () => {
    const effect = effectWith(MAP);
    const map = srgbTexture();
    effect.setGlowMap(map);
    expect(sampledMap(effect)).toBe(map);
  });

  it('samples white after clearGlowMap, which leaves the glow unscaled', () => {
    const effect = effectWith(MAP);
    effect.setGlowMap(srgbTexture());
    effect.clearGlowMap();
    expect(Array.from((sampledMap(effect) as THREE.DataTexture).image.data as Uint8Array)).toEqual([
      255, 255, 255, 255,
    ]);
  });

  it('samples white from construction, before any map arrives', () => {
    expect(Array.from((sampledMap(effectWith(MAP)) as THREE.DataTexture).image.data as Uint8Array)).toEqual([
      255, 255, 255, 255,
    ]);
  });

  it('binds no map when the environment names none (edge case)', () => {
    const effect = effectWith({});
    effect.setGlowMap(srgbTexture());
    effect.clearGlowMap();
    expect(effect.uniforms.has(GLOW_MAP_UNIFORM)).toBe(false);
  });
});
