import { describe, expect, it } from 'vitest';
import { parseCanvasItemMaterial } from './parser';
import { CanvasItemBlendMode, CanvasItemLightMode } from './types';

describe('parseCanvasItemMaterial', () => {
  it('defaults to MIX blending, NORMAL lighting and no particle animation', () => {
    const m = parseCanvasItemMaterial({});
    expect(m.blendMode).toBe(CanvasItemBlendMode.MIX);
    expect(m.lightMode).toBe(CanvasItemLightMode.NORMAL);
    expect(m.particlesAnimation).toBe(false);
    expect(m.particlesAnimHFrames).toBe(1);
    expect(m.particlesAnimVFrames).toBe(1);
    expect(m.particlesAnimLoop).toBe(false);
  });

  it('reads the enums the isometric dungeon authors', () => {
    // Its `TopLight` polygons carry both at once: additive AND unshaded.
    const m = parseCanvasItemMaterial({ blend_mode: '1', light_mode: '1' });
    expect(m.blendMode).toBe(CanvasItemBlendMode.ADD);
    expect(m.lightMode).toBe(CanvasItemLightMode.UNSHADED);
  });

  it('reads the particle-sheet fields', () => {
    const m = parseCanvasItemMaterial({
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
    expect(parseCanvasItemMaterial({ blend_mode: '9' }).blendMode).toBe(CanvasItemBlendMode.MIX);
    expect(parseCanvasItemMaterial({ blend_mode: '-1' }).blendMode).toBe(CanvasItemBlendMode.MIX);
    expect(parseCanvasItemMaterial({ light_mode: 'nope' }).lightMode).toBe(
      CanvasItemLightMode.NORMAL
    );
  });
});
