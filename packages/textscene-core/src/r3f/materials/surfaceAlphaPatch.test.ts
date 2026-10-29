import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { surfaceAlphaProps, type SurfaceAlphaSource } from './surfaceAlphaPatch';
import {
  DROPS_ALBEDO_ALPHA,
  PROGRAM_OF_TYPE,
  programShader,
  WRITES_OPAQUE_AFTER_CUT,
  patchedShader,
} from '../testing/patchedFragment';

const READS_ALBEDO: SurfaceAlphaSource = { readsAlbedoAlpha: true, opaqueAfterCut: false };
const IGNORES_ALBEDO: SurfaceAlphaSource = { readsAlbedoAlpha: false, opaqueAfterCut: false };
const CUT: SurfaceAlphaSource = { readsAlbedoAlpha: true, opaqueAfterCut: true };

const ADDITIVE = { transparent: false, blending: THREE.AdditiveBlending };

describe('surfaceAlphaProps', () => {
  it('adds nothing to an unblended surface, which three writes at alpha 1', () => {
    expect(surfaceAlphaProps(CUT, { transparent: false })).toEqual({});
  });

  it('adds nothing to a NoBlending surface, even when transparent', () => {
    expect(surfaceAlphaProps(CUT, { transparent: true, blending: THREE.NoBlending })).toEqual({});
  });

  it('overwrites past the cut of a blended MIX surface', () => {
    expect(surfaceAlphaProps(CUT, { transparent: true })).toEqual({ blending: THREE.NoBlending });
  });

  it('keeps the blend of a cut surface blended other than MIX', () => {
    expect(surfaceAlphaProps(CUT, ADDITIVE).blending).toBeUndefined();
  });

  it('adds nothing to a blended surface that reads its albedo alpha', () => {
    expect(surfaceAlphaProps(READS_ALBEDO, { transparent: true })).toEqual({});
  });
});

describe.each(Object.entries(PROGRAM_OF_TYPE))('the %s fragment shader', (_type, program) => {
  const { fragmentShader } = programShader(program);

  it('takes the alpha from the opacity before the cut, where the shader never reads the albedo alpha', () => {
    const { injection } = surfaceAlphaProps(IGNORES_ALBEDO, { transparent: true });
    expect(patchedShader(injection!.onBeforeCompile, fragmentShader)).toContain(
      `${DROPS_ALBEDO_ALPHA}\n\t#include <alphatest_fragment>`
    );
  });

  it('writes alpha 1 after the cut of a surface blended other than MIX', () => {
    const { injection } = surfaceAlphaProps(CUT, ADDITIVE);
    expect(patchedShader(injection!.onBeforeCompile, fragmentShader)).toContain(
      `#include <alphahash_fragment>\n\t${WRITES_OPAQUE_AFTER_CUT}`
    );
  });
});
