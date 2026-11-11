/**
 * The material one PointLight2D adds to the accumulator. Each `Light2D.BlendMode` is one
 * fixed-function blend of `light_blend_compute`, so the blend state is the port: an approximation
 * shows up as two modes sharing one set of factors.
 */

import { describe, it, expect } from 'vitest';
import { canvasShadowAtlasSize } from '../../godot/rendering/canvasShadowAtlas';
import * as THREE from 'three';
import { createLightQuadMaterial, updateShadowPolarTexture, type ShadowSampling } from './lightQuad';
import { SHADOW_MAP_FAR } from './shadowPolarMap';
import { SHADOW_TAPS } from './shadowTaps';
import { createShadowPoseUniforms, writeShadowPose } from './shadowSampling';
import { shadowSampling } from './testing/shadowSampling';
import { Light2DBlendMode, Light2DShadowFilter } from '../../godot/scene/light2d';

/** The size Godot uses when the project sets none. */
const DEFAULT_ATLAS_SIZE = canvasShadowAtlasSize(undefined);

const WARM = { r: 1, g: 0.75, b: 0.35, a: 1 };

function material(blendMode: number, energy = 1) {
  return createLightQuadMaterial({ cookie: new THREE.Texture(), color: WARM, energy, blendMode });
}

/** A shadowed cookie quad with everything but the sampling left at its default. */
function shadowedMaterial(shadow: ShadowSampling = shadowSampling()) {
  return createLightQuadMaterial({
    cookie: new THREE.Texture(),
    color: WARM,
    energy: 1,
    blendMode: 0,
    shadow,
  });
}

describe('createLightQuadMaterial', () => {
  it('fades the cookie over its outer half texel, as the transparent atlas border around it does', () => {
    // Godot samples the cookie from a light atlas cleared to transparent black, so the linear
    // filter blends the outermost texels toward 0 (`texture_storage.cpp:3204`). A clamped sample
    // would hold the edge texel at full alpha.
    const mat = material(Light2DBlendMode.MIX);
    expect(mat.fragmentShader).toContain('sampleCookie(vLightUv)');
    expect(mat.fragmentShader).not.toContain('texture2D(uCookie, vLightUv)');
    expect(mat.uniforms.uCookieEdgeFade!.value).toBe(1);
  });

  it('keeps a nearest-filtered cookie whole to its edge, as a nearest tap reads one texel', () => {
    const cookie = new THREE.Texture();
    cookie.magFilter = THREE.NearestFilter;
    const mat = createLightQuadMaterial({ cookie, color: WARM, energy: 1, blendMode: 0 });
    expect(mat.uniforms.uCookieEdgeFade!.value).toBe(0);
  });

  it('emits the light term unclamped, in sRGB, with the cookie alpha kept separate', () => {
    const mat = material(Light2DBlendMode.ADD);
    // rgb is the light term. Alpha stays raw: the accumulator needs it as the blend factor and,
    // summed, as the Light Only mask.
    expect(mat.fragmentShader).toContain('vec4(cookie.rgb * uColor * uEnergy, cookie.a)');
    expect(mat.fragmentShader).not.toContain('clamp(');
  });

  it('carries colour and energy as separate sRGB uniforms', () => {
    const mat = material(Light2DBlendMode.ADD, 2);
    const color = mat.uniforms.uColor!.value as THREE.Vector3;
    expect([color.x, color.y, color.z]).toEqual([1, 0.75, 0.35]);
    expect(mat.uniforms.uEnergy!.value).toBe(2);
  });

  it('accumulates ADD as src×srcAlpha + dst', () => {
    const mat = material(Light2DBlendMode.ADD);
    expect(mat.blending).toBe(THREE.CustomBlending);
    expect(mat.blendEquation).toBe(THREE.AddEquation);
    expect(mat.blendSrc).toBe(THREE.SrcAlphaFactor);
    expect(mat.blendDst).toBe(THREE.OneFactor);
  });

  it('accumulates SUB by reverse-subtracting that same term', () => {
    const mat = material(Light2DBlendMode.SUB);
    expect(mat.blendEquation).toBe(THREE.ReverseSubtractEquation);
    expect(mat.blendSrc).toBe(THREE.SrcAlphaFactor);
    expect(mat.blendDst).toBe(THREE.OneFactor);
  });

  it('accumulates MIX by interpolating toward the light', () => {
    const mat = material(Light2DBlendMode.MIX);
    expect(mat.blendEquation).toBe(THREE.AddEquation);
    expect(mat.blendSrc).toBe(THREE.SrcAlphaFactor);
    expect(mat.blendDst).toBe(THREE.OneMinusSrcAlphaFactor);
  });

  it('sums the coverage mask whatever the colour mode does', () => {
    // light_only_alpha is a plain sum, measured: three overlapping cookies of
    // alpha 0.3 mask to 0.9, not to the 0.657 a screen combination would give.
    for (const mode of [Light2DBlendMode.ADD, Light2DBlendMode.SUB, Light2DBlendMode.MIX]) {
      const mat = material(mode);
      expect(mat.blendEquationAlpha, `mode ${mode}`).toBe(THREE.AddEquation);
      expect(mat.blendSrcAlpha, `mode ${mode}`).toBe(THREE.OneFactor);
      expect(mat.blendDstAlpha, `mode ${mode}`).toBe(THREE.OneFactor);
    }
  });

  it('gives the three modes three distinct blends', () => {
    const signature = (mode: number) => {
      const m = material(mode);
      return `${m.blendEquation}/${m.blendSrc}/${m.blendDst}`;
    };
    const all = [
      signature(Light2DBlendMode.ADD),
      signature(Light2DBlendMode.SUB),
      signature(Light2DBlendMode.MIX),
    ];
    expect(new Set(all).size).toBe(3);
  });

  it('sorts with the transparent list, so lights replay in canvas order', () => {
    // The opaque list sorts nearest-first, reversing canvas order, and MIX depends on light order.
    expect(material(Light2DBlendMode.MIX).transparent).toBe(true);
  });

  it('never occludes or is occluded: a light has no depth of its own', () => {
    const mat = material(Light2DBlendMode.ADD);
    expect(mat.depthTest).toBe(false);
    expect(mat.depthWrite).toBe(false);
  });

  it('falls back to ADD for an out-of-range blend mode', () => {
    const mat = material(99);
    expect(mat.blendEquation).toBe(THREE.AddEquation);
    expect(mat.blendDst).toBe(THREE.OneFactor);
  });
});

describe('updateShadowPolarTexture', () => {
  it('carries the atlas state Godot samples the map with', () => {
    // `renderer_canvas_render_rd.cpp:975-980,1930-1934`: an R32_SFLOAT row behind a nearest
    // sampler that repeats on u, so a tap at bin -1 reads the last bin.
    const texture = updateShadowPolarTexture(null, new Float32Array(DEFAULT_ATLAS_SIZE));
    expect(texture.type).toBe(THREE.FloatType);
    expect(texture.minFilter).toBe(THREE.NearestFilter);
    expect(texture.magFilter).toBe(THREE.NearestFilter);
    expect(texture.wrapS).toBe(THREE.RepeatWrapping);
    expect(texture.image.width).toBe(DEFAULT_ATLAS_SIZE);
    expect(texture.image.height).toBe(1);
    expect(texture.colorSpace).toBe(THREE.NoColorSpace);
    expect(texture.generateMipmaps).toBe(false);
  });

  it('keeps an occluder distance at full float precision', () => {
    // A half float rounds 0.6 + 2^-20 to 0.6, and a fragment on the occluder line then reads as
    // shadowed where Godot lights it.
    const bins = new Float32Array(DEFAULT_ATLAS_SIZE).fill(SHADOW_MAP_FAR);
    bins[7] = Math.fround(0.6 + 2 ** -20);
    const texture = updateShadowPolarTexture(null, bins);
    const data = texture.image.data as Float32Array;
    expect(data[0]).toBe(SHADOW_MAP_FAR);
    expect(data[7]).toBe(bins[7]);
  });

  it('refills a texture of the same size in place, so the materials keep it', () => {
    const texture = updateShadowPolarTexture(null, new Float32Array(DEFAULT_ATLAS_SIZE));
    const bins = new Float32Array(DEFAULT_ATLAS_SIZE).fill(SHADOW_MAP_FAR);
    expect(updateShadowPolarTexture(texture, bins)).toBe(texture);
    expect((texture.image.data as Float32Array)[0]).toBe(SHADOW_MAP_FAR);
  });

  it('makes a fresh texture for bins of another size (edge case)', () => {
    const texture = updateShadowPolarTexture(null, new Float32Array(8));
    const next = updateShadowPolarTexture(texture, new Float32Array(DEFAULT_ATLAS_SIZE));
    expect(next).not.toBe(texture);
    expect(next.image.width).toBe(DEFAULT_ATLAS_SIZE);
  });
});

describe('createLightQuadMaterial with a shadow', () => {
  it('leaves the unshadowed material untouched', () => {
    const mat = material(Light2DBlendMode.ADD);
    expect(mat.defines?.SHADOW_FILTER).toBeUndefined();
    expect(mat.uniforms.uShadowMap).toBeUndefined();
    expect(mat.fragmentShader).not.toContain('shadowFraction');
  });

  it('selects the taps by shadow_filter, NONE included', () => {
    const none = shadowedMaterial(shadowSampling({ filter: Light2DShadowFilter.NONE }));
    const pcf5 = shadowedMaterial();
    const pcf13 = shadowedMaterial(shadowSampling({ filter: Light2DShadowFilter.PCF13 }));
    expect([none, pcf5, pcf13].map((mat) => mat.defines?.SHADOW_FILTER)).toEqual([0, 1, 2]);
  });

  it('reads the map through the taps a DirectionalLight2D reads its own map with', () => {
    expect(shadowedMaterial().fragmentShader).toContain(SHADOW_TAPS);
  });

  it('reads a bin at its centre and lets the map repeat past either end', () => {
    // A clamp here would turn the tap at bin -1 into bin 0, where Godot's sampler reads bin 2047.
    expect(shadowedMaterial().fragmentShader).toContain(
      'texture2D(uShadowMap, vec2((texel + 0.5) / shadowBins(), 0.5)).r'
    );
  });

  it('hands the taps shadow_filter_smooth, which they step by over the map width', () => {
    const mat = shadowedMaterial(shadowSampling({ smooth: 8 }));
    expect(mat.uniforms.uShadowSmooth!.value).toBe(8);
  });

  it('reads the light-local transform and z_far from the pose the light writes', () => {
    const pose = createShadowPoseUniforms();
    const mat = shadowedMaterial(shadowSampling({ pose }));
    expect(mat.uniforms.uWorldToLight).toBe(pose.uWorldToLight);
    expect(mat.uniforms.uShadowZFarInv).toBe(pose.uShadowZFarInv);
    // The fragment's world position is what the transform is applied to, so the
    // vertex stage has to publish it.
    expect(mat.vertexShader).toContain('vWorld = world.xy');
  });

  it('writes the 2x3 affine and the z_far of radius_cache * 1.1 into the pose', () => {
    const pose = createShadowPoseUniforms();
    const rect = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    writeShadowPose(pose, { worldToLocal: [0, 1, -300, -1, 0, 400], rect, radius: 1000 });
    expect(pose.uWorldToLight.value.elements).toEqual([0, -1, 0, 1, 0, 0, -300, 400, 1]);
    expect(pose.uShadowZFarInv.value).toBe(1 / 1100);
  });

  it('scales BOTH rgb and alpha by the lit fraction, which is the (1-s)^2 falloff', () => {
    const mat = shadowedMaterial();
    expect(mat.fragmentShader).toContain('cookie.rgb * uColor * uEnergy * lit');
    expect(mat.fragmentShader).toContain('cookie.a * (lit + s * uShadowColor.a)');
  });

  it('keeps the accumulator blends the unshadowed quad uses', () => {
    for (const mode of [Light2DBlendMode.ADD, Light2DBlendMode.SUB, Light2DBlendMode.MIX]) {
      const plain = material(mode);
      const shadowed = createLightQuadMaterial({
        cookie: new THREE.Texture(),
        color: WARM,
        energy: 1,
        blendMode: mode,
        shadow: shadowSampling(),
      });
      expect(shadowed.blendEquation, `mode ${mode}`).toBe(plain.blendEquation);
      expect(shadowed.blendSrc, `mode ${mode}`).toBe(plain.blendSrc);
      expect(shadowed.blendDst, `mode ${mode}`).toBe(plain.blendDst);
    }
  });
});

describe('the outputs of a light quad', () => {
  const mainOf = (mat: THREE.ShaderMaterial) => mat.fragmentShader.split('void main()')[1]!;

  it('writes the light, the shadow_color and the Light Only term to attachments 0, 1 and 2', () => {
    // One draw fills every buffer of a list (`CanvasLightPass.tsx`), so a quad declares all three.
    const mat = shadowedMaterial();
    expect(mat.glslVersion).toBe(THREE.GLSL3);
    for (const location of [0, 1, 2]) {
      expect(mat.fragmentShader).toContain(`layout(location = ${location}) out highp vec4`);
    }
  });

  it('evaluates the shadow taps once per fragment, whatever the buffers it writes', () => {
    // Godot calls `light_shadow_compute` once per light per fragment (`canvas.glsl:839`). A second
    // evaluation per buffer is what made a tinted light cost twice the frame time (#1262).
    expect(mainOf(shadowedMaterial()).match(/shadowFraction\(\)/g)).toHaveLength(1);
  });

  it('writes the shadow_color term under the same alpha as the light term', () => {
    // A MIX blend scales both buffers by it, so the two must agree.
    const main = mainOf(shadowedMaterial());
    expect(main).toContain('float alpha = cookie.a * (lit + s * uShadowColor.a)');
    expect(main).toContain('vec4(uShadowColor.rgb * s, alpha)');
  });

  it('writes the Light Only buffer the term the light buffer gets', () => {
    expect(shadowedMaterial().fragmentShader).toContain('lightOnlyColor = light;');
  });

  it('writes an unshadowed light to the shadow_color buffer as its alpha alone', () => {
    // A MIX light scales that buffer by its alpha even where nothing tints.
    expect(mainOf(material(Light2DBlendMode.MIX))).toContain('vec4(0.0, 0.0, 0.0, cookie.a)');
  });

  it('carries the shadow colour as a straight sRGB uniform', () => {
    const shadowColor = { r: 0.15, g: 0.35, b: 1, a: 0.5 };
    const v = shadowedMaterial(shadowSampling({ shadowColor })).uniforms.uShadowColor!.value as THREE.Vector4;
    expect([v.x, v.y, v.z, v.w]).toEqual([0.15, 0.35, 1, 0.5]);
  });
});
