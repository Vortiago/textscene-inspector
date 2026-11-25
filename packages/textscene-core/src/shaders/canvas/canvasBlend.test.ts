import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { parsedShader } from '../language/parseShader.js';
import { canvasBlendState } from './canvasBlend.js';

const blendOf = (modes: string) =>
  canvasBlendState(parsedShader(`shader_type canvas_item;\n${modes}\n`).tree).blending;

describe('canvasBlendState', () => {
  it('blends as blend_mix with no render mode', () => {
    expect(blendOf('')).toBe(THREE.NormalBlending);
  });

  it('adds for blend_add', () => {
    expect(blendOf('render_mode blend_add;')).toBe(THREE.AdditiveBlending);
  });

  it('programs Godot factors for blend_mul', () => {
    const state = canvasBlendState(parsedShader('shader_type canvas_item;\nrender_mode blend_mul;\n').tree);

    expect([state.blending, state.blendSrc, state.blendDst]).toEqual([
      THREE.CustomBlending,
      THREE.DstColorFactor,
      THREE.ZeroFactor,
    ]);
  });

  it('turns blending off for blend_disabled', () => {
    expect(blendOf('render_mode blend_disabled;')).toBe(THREE.NoBlending);
  });
});
