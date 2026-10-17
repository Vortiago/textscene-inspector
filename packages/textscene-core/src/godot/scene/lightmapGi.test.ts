import { describe, expect, it } from 'vitest';
import {
  LIGHTMAP_GI_BAKE_QUALITY_NAMES,
  LIGHTMAP_GI_ENVIRONMENT_MODE_NAMES,
  LIGHTMAP_GI_GENERATE_PROBES_NAMES,
  LIGHTMAP_GI_SHADOWMASK_MODE_NAMES,
} from './lightmapGi.js';

describe('LightmapGI enum label tables', () => {
  it('names the bake qualities (lightmap_gi.h:150-155)', () => {
    expect(LIGHTMAP_GI_BAKE_QUALITY_NAMES).toEqual({ 0: 'LOW', 1: 'MEDIUM', 2: 'HIGH', 3: 'ULTRA' });
  });

  it('names the probe generation modes (lightmap_gi.h:157-163)', () => {
    expect(LIGHTMAP_GI_GENERATE_PROBES_NAMES).toEqual({
      0: 'DISABLED',
      1: 'SUBDIV_4',
      2: 'SUBDIV_8',
      3: 'SUBDIV_16',
      4: 'SUBDIV_32',
    });
  });

  it('names the environment modes (lightmap_gi.h:180-185)', () => {
    expect(LIGHTMAP_GI_ENVIRONMENT_MODE_NAMES).toEqual({
      0: 'DISABLED',
      1: 'SCENE',
      2: 'CUSTOM_SKY',
      3: 'CUSTOM_COLOR',
    });
  });

  it('names the three shadowmask modes the hint offers, SHADOWMASK_MODE_ONLY left out (lightmap_gi.h:46-51)', () => {
    expect(LIGHTMAP_GI_SHADOWMASK_MODE_NAMES).toEqual({ 0: 'NONE', 1: 'REPLACE', 2: 'OVERLAY' });
  });
});
