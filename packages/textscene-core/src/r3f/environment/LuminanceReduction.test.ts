/**
 * The passes that reduce the HDR frame to one luminance (`luminance.cpp:158-250`): each level reads
 * the one before, the first reads the frame, and only the last holds the average between the bounds.
 */

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { LuminanceReduction } from './LuminanceReduction';
import {
  AUTO_EXPOSURE_SCALE_UNIFORM,
  LUMINANCE_MAX_UNIFORM,
  LUMINANCE_MIN_UNIFORM,
  LUMINANCE_SOURCE_UNIFORM,
  LUMINANCE_UNIFORM,
} from '../../resources/environment/godotLuminance';
import { testRenderer } from '../../testing/recordingWebGL';

const AUTO_EXPOSURE = { scale: 0.4, minLuminance: 0.25, maxLuminance: 2 };

interface Pass {
  fragmentShader: string;
  source: THREE.Texture;
  target: THREE.WebGLRenderTarget;
  minimum: number | undefined;
  maximum: number | undefined;
}

/** Reduces a frame of `width` x `height` and answers the passes drawn, in order. */
async function reduce(width: number, height: number) {
  const { renderer } = await testRenderer();
  const reduction = new LuminanceReduction(AUTO_EXPOSURE);
  const frame = new THREE.WebGLRenderTarget(width, height);
  const passes: Pass[] = [];
  vi.spyOn(renderer, 'render').mockImplementation((quad) => {
    const material = (quad as THREE.Mesh).material as THREE.ShaderMaterial;
    passes.push({
      fragmentShader: material.fragmentShader,
      source: material.uniforms[LUMINANCE_SOURCE_UNIFORM]!.value as THREE.Texture,
      target: renderer.getRenderTarget() as THREE.WebGLRenderTarget,
      minimum: material.uniforms[LUMINANCE_MIN_UNIFORM]?.value as number | undefined,
      maximum: material.uniforms[LUMINANCE_MAX_UNIFORM]?.value as number | undefined,
    });
  });
  reduction.reduce(renderer, frame);
  return { reduction, frame, passes, renderer };
}

describe('LuminanceReduction.reduce', () => {
  it('draws a level for each size Godot allocates, down to one texel', async () => {
    const { passes } = await reduce(1152, 648);
    expect(passes.map(({ target }) => [target.width, target.height])).toEqual([
      [144, 81],
      [18, 10],
      [2, 1],
      [1, 1],
    ]);
  });

  it('reads the frame first and each level from the one before', async () => {
    const { passes, frame } = await reduce(1152, 648);
    expect(passes[0]!.source).toBe(frame.texture);
    for (let level = 1; level < passes.length; level++) {
      expect(passes[level]!.source).toBe(passes[level - 1]!.target.texture);
    }
  });

  it('reads the largest channel of the frame and the red channel of each level', async () => {
    const { passes } = await reduce(1152, 648);
    expect(passes[0]!.fragmentShader).toContain('max(texel.r, max(texel.g, texel.b))');
    for (const { fragmentShader } of passes.slice(1)) expect(fragmentShader).toContain('sum += texel.r;');
  });

  it('holds the average between the bounds in the last level only', async () => {
    const { passes } = await reduce(1152, 648);
    expect(passes.map(({ minimum, maximum }) => [minimum, maximum])).toEqual([
      [undefined, undefined],
      [undefined, undefined],
      [undefined, undefined],
      [0.25, 2],
    ]);
  });

  it('reads the frame and clamps in one level for a frame of 8 texels a side (edge case)', async () => {
    const { passes, frame } = await reduce(8, 8);
    expect(passes).toHaveLength(1);
    expect(passes[0]!.source).toBe(frame.texture);
    expect([passes[0]!.minimum, passes[0]!.maximum]).toEqual([0.25, 2]);
  });

  it('keeps every level in 32-bit float, as Godot reduces into R32F', async () => {
    const { passes } = await reduce(1152, 648);
    for (const { target } of passes) expect(target.texture.type).toBe(THREE.FloatType);
  });

  it('ends on the texture the tonemap samples', async () => {
    const { reduction, passes } = await reduce(1152, 648);
    expect(reduction.texture).toBe(passes.at(-1)!.target.texture);
  });

  it('hands a shader that divides by the luminance the result texture and the scale', () => {
    const { [LUMINANCE_UNIFORM]: luminance, [AUTO_EXPOSURE_SCALE_UNIFORM]: scale } = new LuminanceReduction(
      AUTO_EXPOSURE
    ).gainUniforms;
    expect(luminance!.value).toBeInstanceOf(THREE.Texture);
    expect(scale!.value).toBe(0.4);
  });

  it('puts the renderer back on the target it found', async () => {
    const { renderer } = await testRenderer();
    const before = new THREE.WebGLRenderTarget(4, 4);
    renderer.setRenderTarget(before);
    const reduction = new LuminanceReduction(AUTO_EXPOSURE);
    reduction.reduce(renderer, new THREE.WebGLRenderTarget(64, 64));
    expect(renderer.getRenderTarget()).toBe(before);
  });

  it('keeps the result texture through a resize, so the shaders that sample it stay bound', async () => {
    const { reduction, renderer } = await reduce(1152, 648);
    const texture = reduction.texture;
    reduction.reduce(renderer, new THREE.WebGLRenderTarget(640, 360));
    expect(reduction.texture).toBe(texture);
  });

  it('sizes its levels to the frame it reduces', async () => {
    const { reduction, renderer } = await reduce(1152, 648);
    const sizes: number[][] = [];
    vi.spyOn(renderer, 'render').mockImplementation(() => {
      const target = renderer.getRenderTarget()!;
      sizes.push([target.width, target.height]);
    });
    reduction.reduce(renderer, new THREE.WebGLRenderTarget(640, 360));
    expect(sizes).toEqual([
      [80, 45],
      [10, 5],
      [1, 1],
    ]);
  });
});
