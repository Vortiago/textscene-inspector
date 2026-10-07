import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { ProgramInjection } from '../materialProgramInputs';
import {
  ALBEDO_ALPHA_UNREAD,
  OPAQUE_AFTER_CUT,
  surfaceAlphaPatch,
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

describe('surfaceAlphaPatch', () => {
  it('patches nothing on an unblended surface, which three writes at alpha 1', () => {
    expect(surfaceAlphaPatch(CUT, { transparent: false })).toBeUndefined();
  });

  it('writes alpha 1 past the cut on a blended surface', () => {
    expect(surfaceAlphaPatch(CUT, { transparent: true })).toBe(OPAQUE_AFTER_CUT);
  });

  it('counts a blend mode other than MIX as blended', () => {
    expect(surfaceAlphaPatch(CUT, { transparent: false, blending: THREE.AdditiveBlending })).toBe(
      OPAQUE_AFTER_CUT
    );
  });

  it('drops the albedo alpha of a blended surface whose shader never reads it', () => {
    expect(surfaceAlphaPatch(IGNORES_ALBEDO, { transparent: true })).toBe(ALBEDO_ALPHA_UNREAD);
  });

  it('patches nothing on a blended surface that reads its albedo alpha', () => {
    expect(surfaceAlphaPatch(READS_ALBEDO, { transparent: true })).toBeUndefined();
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
