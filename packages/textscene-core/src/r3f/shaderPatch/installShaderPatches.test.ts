import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installShaderPatches } from './installShaderPatches';
import { CANVAS_SRGB_DEFINES } from '../canvasSrgbMultiply';

describe('installShaderPatches', () => {
  it('installs the 2D canvas patch with the 3D ones', () => {
    const diffuseBefore = THREE.ShaderChunk.lights_physical_pars_fragment;
    installShaderPatches();
    expect(THREE.ShaderChunk.map_fragment).toContain(Object.keys(CANVAS_SRGB_DEFINES)[0]);
    expect(THREE.ShaderChunk.lights_physical_pars_fragment).not.toBe(diffuseBefore);
  });

  it('changes nothing on a second call', () => {
    installShaderPatches();
    const chunks = { ...THREE.ShaderChunk };
    installShaderPatches();
    expect({ ...THREE.ShaderChunk }).toEqual(chunks);
  });
});
