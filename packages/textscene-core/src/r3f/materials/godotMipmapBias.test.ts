import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  mipmapBiasInjection,
  renderWithMipmapBias,
  viewportSamplersUserData,
  writeMainViewMipmapBias,
} from './godotMipmapBias';
import type { ProgramShader } from '../materialProgramInputs';
import { mipmappedTexture } from '../testing/mipmapBiasUniform';
import { dropMipChain } from '../../resources/textures/godotTextureFilter';

const BIAS_UNIFORM = 'godotMipmapBias';
const INCLUDE = /^[ \t]*#include +<([\w./]+)>/gm;
/** A slot three samples with `texture2D( <slot>, <uv> )` that Godot reads through its material sampler. */
const BIASED_SAMPLE =
  /texture2D\(\s*(map|alphaMap|aoMap|emissiveMap|metalnessMap|roughnessMap|normalMap|anisotropyMap|clearcoat\w*Map|sheen\w*Map|specular(?:Color|Intensity)Map|transmissionMap|thicknessMap|iridescence\w*Map)\s*,/;

function unmipped(): THREE.Texture {
  const texture = mipmappedTexture();
  dropMipChain(texture);
  return texture;
}

/** What `WebGLProgram` compiles: every `#include` resolved, as three resolves them. */
function resolved(source: string): string {
  let text = source;
  for (let pass = 0; pass < 8 && INCLUDE.test(text); pass++) {
    INCLUDE.lastIndex = 0;
    text = text.replace(
      INCLUDE,
      (_, name: string) => THREE.ShaderChunk[name as keyof typeof THREE.ShaderChunk]
    );
  }
  return text;
}

function patched(program: 'basic' | 'standard' | 'physical'): ProgramShader {
  const shader: ProgramShader = {
    vertexShader: THREE.ShaderLib[program].vertexShader,
    fragmentShader: THREE.ShaderLib[program].fragmentShader,
    uniforms: {},
  };
  const injection = mipmapBiasInjection({ userData: viewportSamplersUserData(), map: mipmappedTexture() })!;
  injection.onBeforeCompile.call(new THREE.MeshStandardMaterial(), shader);
  return shader;
}

describe('mipmapBiasInjection', () => {
  it('adds nothing to a material that does not draw through the viewport samplers (2D)', () => {
    expect(mipmapBiasInjection({ userData: {}, map: mipmappedTexture() })).toBeUndefined();
    expect(mipmapBiasInjection({ map: mipmappedTexture() })).toBeUndefined();
  });

  it('adds nothing when no biased slot samples a mip chain, which a mipmap bias cannot change', () => {
    const state = { userData: viewportSamplersUserData() };

    expect(mipmapBiasInjection({ ...state, map: unmipped() })).toBeUndefined();
    expect(mipmapBiasInjection({ ...state, map: null })).toBeUndefined();
    expect(mipmapBiasInjection(state)).toBeUndefined();
  });

  it('adds the bias when any biased slot samples a mip chain, not only the albedo', () => {
    const state = { userData: viewportSamplersUserData(), map: unmipped() };

    expect(mipmapBiasInjection({ ...state, normalMap: mipmappedTexture() })).toBeDefined();
  });

  it.each(['basic', 'standard', 'physical'] as const)(
    'biases every sample of a slot Godot reads through its material sampler in the %s program',
    (program) => {
      const { fragmentShader } = patched(program);
      const compiled = resolved(fragmentShader);

      expect(compiled).not.toMatch(BIASED_SAMPLE);
      expect(compiled).toContain(`uniform float ${BIAS_UNIFORM};`);
    }
  );

  it('leaves a sample Godot reads through another sampler as three wrote it', () => {
    const compiled = resolved(patched('standard').fragmentShader);

    expect(compiled).toContain('texture2D( lightMap, vLightMapUv )');
  });

  it('shares one uniform between programs, so one write reaches every material', () => {
    expect(patched('standard').uniforms[BIAS_UNIFORM]).toBe(patched('physical').uniforms[BIAS_UNIFORM]);
  });
});

describe('the bias a render samples with', () => {
  const uniform = (): THREE.IUniform<number> => patched('basic').uniforms[BIAS_UNIFORM]!;

  it('is the pass bias while the pass renders, and the root bias again after it', () => {
    writeMainViewMipmapBias(-0.5);
    const seen: number[] = [];

    renderWithMipmapBias(1, () => seen.push(uniform().value));

    expect(seen).toEqual([1]);
    expect(uniform().value).toBe(-0.5);
  });

  it('is the pass bias for a main-view render inside the pass (an inline SubViewport)', () => {
    writeMainViewMipmapBias(0);
    const seen: number[] = [];

    renderWithMipmapBias(-1, () => {
      writeMainViewMipmapBias(0);
      seen.push(uniform().value);
    });

    expect(seen).toEqual([-1]);
  });

  it('restores the root bias when the pass throws', () => {
    writeMainViewMipmapBias(0.25);

    expect(() =>
      renderWithMipmapBias(2, () => {
        throw new Error('pass failed');
      })
    ).toThrow('pass failed');

    expect(uniform().value).toBe(0.25);
  });

  it('passes a bias beyond the -2..2 hint through unclamped (viewport.cpp:4904-4911)', () => {
    writeMainViewMipmapBias(-7.5);

    expect(uniform().value).toBe(-7.5);
  });
});
