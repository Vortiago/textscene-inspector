import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { ProgramInjection } from '../materialProgramInputs';
import {
  ALBEDO_ALPHA_UNREAD,
  OPAQUE_AFTER_CUT,
  isBlended,
  surfaceAlphaProps,
  type SurfaceAlphaSource,
} from './surfaceAlphaPatch';

const READS_ALBEDO: SurfaceAlphaSource = { readsAlbedoAlpha: true, opaqueAfterCut: false };
const IGNORES_ALBEDO: SurfaceAlphaSource = { readsAlbedoAlpha: false, opaqueAfterCut: false };
const CUT: SurfaceAlphaSource = { readsAlbedoAlpha: true, opaqueAfterCut: true };

/** The fragment shader of each three class a Godot surface draws with. */
const FRAGMENT_SHADERS = [
  ['basic', THREE.ShaderLib.basic.fragmentShader],
  ['standard', THREE.ShaderLib.standard.fragmentShader],
  ['physical', THREE.ShaderLib.physical.fragmentShader],
] as const;

function patched(injection: ProgramInjection, fragmentShader: string): string {
  const shader = { vertexShader: '', fragmentShader, uniforms: {} };
  injection.onBeforeCompile(shader);
  return shader.fragmentShader;
}

describe('isBlended', () => {
  it('blends a transparent surface under the default blending', () => {
    expect(isBlended({ transparent: true })).toBe(true);
  });

  it('writes an opaque surface under NormalBlending unblended', () => {
    expect(isBlended({ transparent: false, blending: THREE.NormalBlending })).toBe(false);
  });

  it('writes NoBlending unblended even when transparent', () => {
    expect(isBlended({ transparent: true, blending: THREE.NoBlending })).toBe(false);
  });
});

describe('surfaceAlphaProps', () => {
  it('adds nothing to an unblended surface, which three writes at alpha 1', () => {
    expect(surfaceAlphaProps(CUT, { transparent: false })).toEqual({});
  });

  it('overwrites past the cut of a blended MIX surface', () => {
    expect(surfaceAlphaProps(CUT, { transparent: true })).toEqual({ blending: THREE.NoBlending });
  });

  it('writes alpha 1 past the cut of a surface blended other than MIX', () => {
    expect(surfaceAlphaProps(CUT, { transparent: false, blending: THREE.AdditiveBlending })).toEqual({
      injection: OPAQUE_AFTER_CUT,
    });
  });

  it('drops the albedo alpha of a blended surface whose shader never reads it', () => {
    expect(surfaceAlphaProps(IGNORES_ALBEDO, { transparent: true })).toEqual({
      injection: ALBEDO_ALPHA_UNREAD,
    });
  });

  it('adds nothing to a blended surface that reads its albedo alpha', () => {
    expect(surfaceAlphaProps(READS_ALBEDO, { transparent: true })).toEqual({});
  });
});

describe.each(FRAGMENT_SHADERS)('the %s fragment shader', (_name, fragmentShader) => {
  it('takes the alpha from the opacity before the cut', () => {
    expect(patched(ALBEDO_ALPHA_UNREAD, fragmentShader)).toContain(
      'diffuseColor.a = opacity;\n\t#include <alphatest_fragment>'
    );
  });

  it('writes alpha 1 after the cut', () => {
    expect(patched(OPAQUE_AFTER_CUT, fragmentShader)).toContain(
      '#include <alphahash_fragment>\n\tdiffuseColor.a = 1.0;'
    );
  });
});
