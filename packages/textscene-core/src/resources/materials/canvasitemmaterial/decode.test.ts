import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { canvasItemMaterialOf } from './decode';
import { canvasItemBlendState } from './build';
import { parseTresFile } from '../../../parser/parsedResource';
import { type CanvasItemMaterialProperties } from './types';
import {
  CanvasItemMaterialBlendMode,
  CanvasItemMaterialLightMode,
} from '../../../godot/scene/canvasItemMaterial';

/** The CanvasItemMaterial a resource with this property bag draws as. */
function decode(data: Record<string, string>): CanvasItemMaterialProperties {
  return canvasItemMaterialOf({ type: 'CanvasItemMaterial', data })!;
}

describe('the CanvasItemMaterial canvasItemMaterialOf decodes', () => {
  it('defaults to MIX blending, NORMAL lighting and no particle animation', () => {
    const m = decode({});
    expect(m.blendMode).toBe(CanvasItemMaterialBlendMode.MIX);
    expect(m.lightMode).toBe(CanvasItemMaterialLightMode.NORMAL);
    expect(m.particlesAnimation).toBe(false);
    expect(m.particlesAnimHFrames).toBe(1);
    expect(m.particlesAnimVFrames).toBe(1);
    expect(m.particlesAnimLoop).toBe(false);
  });

  it('reads the enums the isometric dungeon authors', () => {
    // A polygon can carry both at once: additive and unshaded.
    const m = decode({ blend_mode: '1', light_mode: '1' });
    expect(m.blendMode).toBe(CanvasItemMaterialBlendMode.ADD);
    expect(m.lightMode).toBe(CanvasItemMaterialLightMode.UNSHADED);
  });

  it('reads the particle-sheet fields', () => {
    const m = decode({
      particles_animation: 'true',
      particles_anim_h_frames: '11',
      particles_anim_v_frames: '2',
      particles_anim_loop: 'true',
    });
    expect(m.particlesAnimation).toBe(true);
    expect(m.particlesAnimHFrames).toBe(11);
    expect(m.particlesAnimVFrames).toBe(2);
    expect(m.particlesAnimLoop).toBe(true);
  });

  it('falls back to the default for an out-of-range or unparseable enum', () => {
    expect(decode({ blend_mode: '9' }).blendMode).toBe(CanvasItemMaterialBlendMode.MIX);
    expect(decode({ blend_mode: '-1' }).blendMode).toBe(CanvasItemMaterialBlendMode.MIX);
    expect(decode({ light_mode: 'nope' }).lightMode).toBe(CanvasItemMaterialLightMode.NORMAL);
  });

  it('is null for a material of another type, which draws with no blend state of its own', () => {
    expect(canvasItemMaterialOf({ type: 'ShaderMaterial', data: { blend_mode: '1' } })).toBeNull();
  });
});

/**
 * An external `.tres` CanvasItemMaterial's `[resource]` body must decode identically to an
 * inline `[sub_resource]` property bag: one decode, two arrival paths (ADR-0031).
 */
describe('a CanvasItemMaterial over a ParsedResource body', () => {
  const TRES = `[gd_resource type="CanvasItemMaterial" format=3]

[resource]
blend_mode = 1
light_mode = 1
particles_animation = true
particles_anim_h_frames = 4
`;

  it('decodes the [resource] body to the data the inline property bag yields', () => {
    const parsed = parseTresFile(TRES);
    expect(parsed.resourceType).toBe('CanvasItemMaterial');
    expect(decode(parsed.properties)).toEqual(
      decode({
        blend_mode: '1',
        light_mode: '1',
        particles_animation: 'true',
        particles_anim_h_frames: '4',
      })
    );
  });

  it('carries that body through to the additive blend state', () => {
    const data = decode(parseTresFile(TRES).properties);
    const state = canvasItemBlendState(data.blendMode);
    expect(state.blending).toBe(THREE.CustomBlending);
    expect(state.blendSrc).toBe(THREE.SrcAlphaFactor);
    expect(state.blendDst).toBe(THREE.OneFactor);
    expect(state.premultipliedAlpha).toBe(false);
  });
});
