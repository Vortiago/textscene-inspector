import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { decodeCanvasItemMaterial } from './decode';
import { canvasItemBlendState } from './build';
import { parseTresFile } from '../../../parser/parsedResource';
import { CanvasItemBlendMode, CanvasItemLightMode } from './types';

describe('decodeCanvasItemMaterial', () => {
  it('defaults to MIX blending, NORMAL lighting and no particle animation', () => {
    const m = decodeCanvasItemMaterial({});
    expect(m.blendMode).toBe(CanvasItemBlendMode.MIX);
    expect(m.lightMode).toBe(CanvasItemLightMode.NORMAL);
    expect(m.particlesAnimation).toBe(false);
    expect(m.particlesAnimHFrames).toBe(1);
    expect(m.particlesAnimVFrames).toBe(1);
    expect(m.particlesAnimLoop).toBe(false);
  });

  it('reads the enums the isometric dungeon authors', () => {
    // Its `TopLight` polygons carry both at once: additive AND unshaded.
    const m = decodeCanvasItemMaterial({ blend_mode: '1', light_mode: '1' });
    expect(m.blendMode).toBe(CanvasItemBlendMode.ADD);
    expect(m.lightMode).toBe(CanvasItemLightMode.UNSHADED);
  });

  it('reads the particle-sheet fields', () => {
    const m = decodeCanvasItemMaterial({
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
    expect(decodeCanvasItemMaterial({ blend_mode: '9' }).blendMode).toBe(CanvasItemBlendMode.MIX);
    expect(decodeCanvasItemMaterial({ blend_mode: '-1' }).blendMode).toBe(CanvasItemBlendMode.MIX);
    expect(decodeCanvasItemMaterial({ light_mode: 'nope' }).lightMode).toBe(
      CanvasItemLightMode.NORMAL
    );
  });
});

/**
 * The ext_resource arrival path's slice half: an external `.tres`
 * CanvasItemMaterial reaches the slice as a ParsedResource, whose `[resource]`
 * body must decode identically to an inline `[sub_resource]` property bag — one
 * decode, two arrival paths (ADR-0031).
 */
describe('decodeCanvasItemMaterial over a ParsedResource body', () => {
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
    expect(decodeCanvasItemMaterial(parsed.properties)).toEqual(
      decodeCanvasItemMaterial({
        blend_mode: '1',
        light_mode: '1',
        particles_animation: 'true',
        particles_anim_h_frames: '4',
      })
    );
  });

  it('carries that body through to the additive blend state', () => {
    const data = decodeCanvasItemMaterial(parseTresFile(TRES).properties);
    const state = canvasItemBlendState(data.blendMode);
    expect(state.blending).toBe(THREE.CustomBlending);
    expect(state.blendSrc).toBe(THREE.SrcAlphaFactor);
    expect(state.blendDst).toBe(THREE.OneFactor);
    expect(state.premultipliedAlpha).toBe(false);
  });
});
