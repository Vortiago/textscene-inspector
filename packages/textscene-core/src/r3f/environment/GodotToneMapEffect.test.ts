/**
 * The glow map as the composite samples it: Godot binds the texture's non-sRGB view, clamped
 * (`renderer_scene_render_rd.cpp:707`, `tone_mapper.cpp:177`).
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GodotToneMapEffect } from './GodotToneMapEffect';
import { glowParamsFor } from '../../resources/environment/godotGlow';
import { decodeEnvironment } from '../../resources/environment/decode';
import { createEnvironmentSettings } from '../../resources/environment/build';
import { GodotToneMapper } from '../../resources/environment/godotToneMapping';
import { DEFAULT_CLEAR_COLOR } from '../../godot/rendering';

function effectWith(properties: Record<string, string>, glowMap: THREE.Texture | null) {
  const settings = createEnvironmentSettings(
    decodeEnvironment({ glow_enabled: 'true', ...properties }),
    DEFAULT_CLEAR_COLOR
  );
  return new GodotToneMapEffect({
    glow: glowParamsFor(settings),
    adjustments: null,
    toneMapping: { mode: GodotToneMapper.FILMIC, white: 1 },
    exposure: 1,
    glowMap,
  });
}

function srgbTexture(): THREE.Texture {
  const texture = new THREE.DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const MAP = { glow_map: 'SubResource("Gradient_1")' };

describe('GodotToneMapEffect — the glow map', () => {
  it('samples the raw texels, clamped, without touching the shared texture', () => {
    const shared = srgbTexture();
    const bound = effectWith(MAP, shared).uniforms.get('godotGlowMap')!.value as THREE.Texture;
    expect(bound.colorSpace).toBe(THREE.NoColorSpace);
    expect(bound.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(shared.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('samples white while the map loads, which leaves the glow unscaled', () => {
    const bound = effectWith(MAP, null).uniforms.get('godotGlowMap')!.value as THREE.DataTexture;
    expect(Array.from(bound.image.data as Uint8Array)).toEqual([255, 255, 255, 255]);
  });

  it('binds no map when the environment names none (edge case)', () => {
    expect(effectWith({}, srgbTexture()).uniforms.has('godotGlowMap')).toBe(false);
  });
});
