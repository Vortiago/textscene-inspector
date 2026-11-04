import { describe, expect, it } from 'vitest';
import {
  SSAO_PROJECT_DEFAULTS,
  SSAO_QUALITY,
} from '../../godot/rendering/environment/screenSpaceAmbientOcclusion';
import { OcclusionBuffers } from './occlusionBuffers';

const ULTRA = { ...SSAO_PROJECT_DEFAULTS, quality: SSAO_QUALITY.ULTRA };

describe('OcclusionBuffers', () => {
  it("counts Ultra's load in whole work groups of the importance map", () => {
    // 1920 wide at half size: slices of 480, and an importance map of 240 by 135.
    const { adaptive } = new OcclusionBuffers({ width: 1920, height: 1080, project: ULTRA });

    expect(adaptive!.groups).toEqual([240, 136]);
  });

  it('sums the load counter in blocks of 16 by 16 counted texels, one texel per block', () => {
    // Every third of 240 by 136 invocations: 80 by 46 counted texels.
    const { adaptive } = new OcclusionBuffers({ width: 1920, height: 1080, project: ULTRA });

    expect([adaptive!.loadCounterBlocks.width, adaptive!.loadCounterBlocks.height]).toEqual([5, 3]);
  });

  it('keeps no adaptive buffers below Ultra', () => {
    const buffers = new OcclusionBuffers({ width: 64, height: 64, project: SSAO_PROJECT_DEFAULTS });

    expect(buffers.adaptive).toBeNull();
  });
});
