import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { transpileSpatial } from './transpileSpatial.js';

/** The material of an unshaded shader with `modes` after `unshaded`. */
const materialWith = (...modes: string[]) =>
  transpileSpatial(`shader_type spatial;\nrender_mode ${['unshaded', ...modes].join(', ')};\n`).material;

/** Godot's attachment of a blend mode (`material_storage.cpp:651-716`), in three's names. */
const ATTACHMENTS = {
  blend_add: [THREE.SrcAlphaFactor, THREE.OneFactor, THREE.AddEquation],
  blend_sub: [THREE.SrcAlphaFactor, THREE.OneFactor, THREE.ReverseSubtractEquation],
  blend_mul: [THREE.DstColorFactor, THREE.ZeroFactor, THREE.AddEquation],
  blend_premul_alpha: [THREE.OneFactor, THREE.OneMinusSrcAlphaFactor, THREE.AddEquation],
} as const;

/** The colour factors and equation a material blends with, from its preset or its own factors. */
function colourBlend(material: THREE.Material) {
  switch (material.blending) {
    case THREE.AdditiveBlending:
      return [THREE.SrcAlphaFactor, THREE.OneFactor, THREE.AddEquation];
    case THREE.CustomBlending:
      return [material.blendSrc, material.blendDst, material.blendEquation];
    default:
      return material.blending;
  }
}

describe('a spatial shader’s draw state', () => {
  it.each([
    ['cull_back', THREE.FrontSide],
    ['cull_front', THREE.BackSide],
    ['cull_disabled', THREE.DoubleSide],
  ])('%s keeps the faces Godot does not cull', (mode, side) => {
    expect(materialWith(mode).side).toBe(side);
  });

  it('culls back faces with no cull mode', () => {
    expect(materialWith().side).toBe(THREE.FrontSide);
  });

  it('draws in the opaque pass with no blend, depth or test mode, writing depth', () => {
    expect(materialWith()).toMatchObject({
      transparent: false,
      blending: THREE.NoBlending,
      depthTest: true,
      depthWrite: true,
      depthFunc: THREE.LessEqualDepth,
    });
  });

  it.each(Object.keys(ATTACHMENTS) as (keyof typeof ATTACHMENTS)[])(
    '%s draws in the alpha pass with Godot’s attachment and writes no depth',
    (mode) => {
      const material = materialWith(mode);
      expect(material).toMatchObject({ transparent: true, depthWrite: false });
      expect(colourBlend(material)).toEqual(ATTACHMENTS[mode]);
    }
  );

  it('blend_mix stays in the opaque pass', () => {
    expect(materialWith('blend_mix')).toMatchObject({ transparent: false, blending: THREE.NoBlending });
  });

  it('depth_draw_never draws in the alpha pass and writes no depth', () => {
    expect(materialWith('depth_draw_never')).toMatchObject({ transparent: true, depthWrite: false });
  });

  it('depth_draw_always writes depth in the alpha pass too', () => {
    expect(materialWith('blend_add', 'depth_draw_always')).toMatchObject({
      transparent: true,
      depthWrite: true,
    });
  });

  it('depth_test_disabled draws in the alpha pass with no depth test', () => {
    expect(materialWith('depth_test_disabled')).toMatchObject({ transparent: true, depthTest: false });
  });

  it('depth_test_inverted keeps the fragments behind the depth, in the alpha pass', () => {
    expect(materialWith('depth_test_inverted')).toMatchObject({
      transparent: true,
      depthTest: true,
      depthFunc: THREE.GreaterDepth,
    });
  });
});
