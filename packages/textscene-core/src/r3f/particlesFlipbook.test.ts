import { describe, expect, it } from 'vitest';
import type { CanvasItemMaterialProperties } from '../resources/materials/canvasitemmaterial/types';
import { flipbookCell, particlesFlipbook } from './particlesFlipbook';

const SHEET = { hFrames: 2, vFrames: 2, loop: false };

describe('particlesFlipbook', () => {
  it('reads the frame counts and loop of a material with particles_animation', () => {
    const material = {
      particlesAnimation: true,
      particlesAnimHFrames: 4,
      particlesAnimVFrames: 3,
      particlesAnimLoop: true,
    } as CanvasItemMaterialProperties;
    expect(particlesFlipbook(material)).toEqual({ hFrames: 4, vFrames: 3, loop: true });
  });

  it('is null without particles_animation, or without a material', () => {
    expect(particlesFlipbook({ particlesAnimation: false } as CanvasItemMaterialProperties)).toBeNull();
    expect(particlesFlipbook(null)).toBeNull();
  });
});

describe('flipbookCell', () => {
  it('picks the cell floor(z × frames), and windows the UV to it', () => {
    // z 0.5 of 4 frames is cell 2: column 0, row 1.
    expect(flipbookCell(SHEET, 0.5)).toEqual({ hFrames: 2, vFrames: 2, uOffset: 0, vOffset: 0.5 });
  });

  it('holds the last cell when it does not loop', () => {
    expect(flipbookCell(SHEET, 5)).toMatchObject({ uOffset: 0.5, vOffset: 0.5 });
    expect(flipbookCell(SHEET, -1)).toMatchObject({ uOffset: 0, vOffset: 0 });
  });

  it('wraps past the last cell when it loops, as GLSL mod does for a negative z', () => {
    const loop = { ...SHEET, loop: true };
    expect(flipbookCell(loop, 1.25)).toMatchObject({ uOffset: 0.5, vOffset: 0 });
    expect(flipbookCell(loop, -0.25)).toMatchObject({ uOffset: 0.5, vOffset: 0.5 });
  });

  it('falls back to the first cell for a z that is not finite', () => {
    expect(flipbookCell(SHEET, Number.NaN)).toMatchObject({ uOffset: 0, vOffset: 0 });
  });

  it('shows the whole texture with no flipbook', () => {
    expect(flipbookCell(null, 0.7)).toEqual({ hFrames: 1, vFrames: 1, uOffset: 0, vOffset: 0 });
  });
});
