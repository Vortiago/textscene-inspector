/** Godot's `DISTANCE_FADE_PIXEL_DITHER` in three's programs (`material.cpp:1863-1885`). */
import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { pixelDitherFade } from './godotPixelDitherFade';

function compile(min: number, max: number) {
  const shader = {
    vertexShader: 'void main() {\n#include <project_vertex>\n}',
    fragmentShader: 'void main() {\n#include <color_fragment>\n}',
    uniforms: {} as Record<string, THREE.IUniform>,
  };
  pixelDitherFade(min, max).onBeforeCompile.call({} as THREE.Material, shader);
  return shader;
}

describe('pixelDitherFade', () => {
  it('hands the fade range to the program as uniforms', () => {
    const { uniforms } = compile(0.2, 0.6);
    expect([uniforms.godotFadeMin!.value, uniforms.godotFadeMax!.value]).toEqual([0.2, 0.6]);
  });

  it('measures the distance from the camera to the vertex, in the vertex shader', () => {
    expect(compile(0.2, 0.6).vertexShader).toMatch(
      /project_vertex>\s*vGodotFadeDistance = length\( mvPosition\.xyz \)/
    );
  });

  it('discards a fragment below the interleaved gradient noise of its pixel, or below 0.001', () => {
    const { fragmentShader } = compile(0.2, 0.6);
    expect(fragmentShader).toContain('smoothstep( godotFadeMin, godotFadeMax, vGodotFadeDistance )');
    expect(fragmentShader).toContain('fade < 0.001 || fade < godotQuickHash( gl_FragCoord.xy )');
    expect(fragmentShader).toContain('discard');
  });

  it('keeps one program for every range, as the range is a uniform', () => {
    expect(pixelDitherFade(0.2, 0.6).cacheKey).toBe(pixelDitherFade(1, 2).cacheKey);
  });
});
