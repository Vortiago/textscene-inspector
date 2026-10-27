/**
 * The lightmap's read in three's lit programs, against Godot's in
 * `scene_forward_clustered.glsl:921-978` and `:1835-1876`.
 */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { ProgramShader } from '../materialProgramInputs';
import { functionBody } from '../testing/glslSource';
import { GLSL_BUILT_INS, scalarGlslFunction } from '../testing/glslScalar';
import { ShadowmaskMode } from '../../godot/scene/lightmapGi';
import { bindLightmap, LIGHTMAP_PROGRAM, readsLightmap } from './lightmapProgram';
import { LightmapInstance, type LightmapAssignment } from './sceneLightmaps';

function compiled(material: THREE.Material = new THREE.MeshStandardMaterial()): ProgramShader {
  const shader: ProgramShader = {
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    uniforms: {},
  };
  LIGHTMAP_PROGRAM.onBeforeCompile.call(material, shader);
  return shader;
}

/** A drawn lightmap of a 64 x 32 atlas, and a user in slice 2 at `uvScale`. */
function assignment(): LightmapAssignment {
  const lightmap = new LightmapInstance(new THREE.Object3D());
  lightmap.atlas = new THREE.DataArrayTexture(new Uint16Array(64 * 32 * 4 * 3), 64, 32, 3);
  lightmap.isDrawn = true;
  const user = {
    path: '../Floor',
    uvScale: { x: 0.25, y: 0.5, width: 0.5, height: 0.125 },
    sliceIndex: 2,
    subInstance: -1,
  };
  return { lightmap, user };
}

/** The uniforms a material bound to `bound` compiles with. */
function uniformsBoundTo(bound: LightmapAssignment | null) {
  const material = new THREE.MeshStandardMaterial();
  bindLightmap(material, bound);
  return compiled(material).uniforms;
}

const fragment = compiled().fragmentShader;
const weight = (name: string) => scalarGlslFunction(fragment, name);

describe('readsLightmap', () => {
  it('reads the lightmap of an opaque lit surface', () => {
    expect(readsLightmap(true, false)).toBe(true);
  });

  it('reads none on a transparent surface, which draws outside the opaque pass', () => {
    expect(readsLightmap(true, true)).toBe(false);
  });

  it('reads none on an unshaded surface (edge case)', () => {
    expect(readsLightmap(false, false)).toBe(false);
  });
});

describe('LIGHTMAP_PROGRAM shaders', () => {
  it('defines GODOT_LIGHTMAP, which turns on the static-light skip', () => {
    expect(fragment).toMatch(/^#define GODOT_LIGHTMAP$/m);
  });

  it('carries the UV2 to the fragment', () => {
    const vertex = compiled().vertexShader;
    expect(vertex.indexOf('vGodotLightmapUv = uv1;')).toBeGreaterThan(vertex.indexOf('#include <uv_vertex>'));
  });

  it("puts the lightmap in the ambient's place once three has read its maps", () => {
    const after = fragment.slice(fragment.indexOf('#include <lights_fragment_maps>'));
    expect(after).toContain('irradiance = PI * godotLightmapAmbient(');
    expect(after).toContain('iblIrradiance = vec3( 0.0 );');
  });

  it('places the UV2 in the atlas by the user rect and slice', () => {
    expect(functionBody(fragment, 'vec3 godotLightmapUvw')).toContain(
      'return vec3( vGodotLightmapUv * godotLightmapUvScale.zw + godotLightmapUvScale.xy, layer );'
    );
    expect(functionBody(fragment, 'vec3 godotLightmapUvw')).toContain(
      'float layer = godotLightmapSlice * ( godotLightmapUsesSH ? 4.0 : 1.0 );'
    );
  });

  it('reads the lightmap and the shadowmask at that one place', () => {
    expect(functionBody(fragment, 'vec3 godotLightmapAmbient')).toContain('vec3 uvw = godotLightmapUvw();');
    expect(functionBody(fragment, 'float godotLightmapShadowmask')).toContain(
      'vec3 uvw = godotLightmapUvw();'
    );
  });

  it('reads four layers per slice of directional data, and lights the L1 bands along the normal', () => {
    const ambient = functionBody(fragment, 'vec3 godotLightmapAmbient');
    expect(ambient).toContain(
      'return l0 + l1n1 * n.y * ( l0 * 4.0 ) + l1z * n.z * ( l0 * 4.0 ) + l1p1 * n.x * ( l0 * 4.0 );'
    );
  });
});

describe('the lightmap exposure', () => {
  const ambient = functionBody(fragment, 'vec3 godotLightmapAmbient');

  it('scales the L0 texel of a plain lightmap (scene_forward_clustered.glsl:1872-1874)', () => {
    expect(ambient).toContain('vec3 l0 = godotLightmapTexel( uvw ) * godotLightmapExposure;');
  });

  it('scales only L0 of directional data, which the L1 bands then follow through l0 * 4.0 (:1863-1868)', () => {
    expect(ambient).not.toMatch(/l1\w+ = [^;]*godotLightmapExposure/);
  });
});

const { mix } = GLSL_BUILT_INS;

/**
 * The shadow of a sun that Godot hands the light. `shadow` is the lookup, `fadeOut` the sun's
 * fade, `opacity` the light's `shadow_opacity`, which Godot applies once after the fade
 * (`scene_forward_clustered.glsl:2483-2492`, `:2597`).
 */
const godotReplace = (shadow: number, mask: number, fadeOut: number, opacity: number) =>
  mix(1, mix(shadow, mask, fadeOut), opacity);
const godotOverlay = (shadow: number, mask: number, fadeOut: number, opacity: number) =>
  mix(1, mask * mix(shadow, 1, fadeOut), opacity);

describe('the shadowmask mix', () => {
  const replace = scalarGlslFunction(fragment, 'godotShadowmaskReplace');
  const overlay = scalarGlslFunction(fragment, 'godotShadowmaskOverlay');

  /** The lookup as `getSunShadow` hands it on: its opacity already applied. */
  const opacityApplied = (shadow: number, opacity: number) => mix(1, shadow, opacity);

  it.each([
    { shadow: 0.2, mask: 0.6, fadeOut: 0.3, opacity: 1 },
    { shadow: 0.2, mask: 0.6, fadeOut: 0.3, opacity: 0.7 },
    { shadow: 1, mask: 0.1, fadeOut: 0, opacity: 0.4 },
    { shadow: 0.9, mask: 0, fadeOut: 0.8, opacity: 0.25 },
  ])('gives Replace as Godot mixes it, for %j', ({ shadow, mask, fadeOut, opacity }) => {
    expect(replace(opacityApplied(shadow, opacity), mask, fadeOut, opacity)).toBeCloseTo(
      godotReplace(shadow, mask, fadeOut, opacity),
      12
    );
  });

  it.each([
    { shadow: 0.2, mask: 0.6, fadeOut: 0.3, opacity: 1 },
    { shadow: 0.2, mask: 0.6, fadeOut: 0.3, opacity: 0.7 },
    { shadow: 1, mask: 0.1, fadeOut: 0, opacity: 0.4 },
    { shadow: 0.9, mask: 0, fadeOut: 0.8, opacity: 0.25 },
  ])('gives Overlay as Godot multiplies it, for %j', ({ shadow, mask, fadeOut, opacity }) => {
    expect(overlay(opacityApplied(shadow, opacity), mask, fadeOut, opacity)).toBeCloseTo(
      godotOverlay(shadow, mask, fadeOut, opacity),
      12
    );
  });

  it('gives mode Only the shadowmask byte to the first drawn light and full shadow to the others', () => {
    const only = scalarGlslFunction(fragment, 'godotShadowmaskOnly');
    expect(only(0.6, 1, 1)).toBeCloseTo(Math.trunc(0.6 * 255) / 255, 12);
    expect(only(0.6, 0, 1)).toBe(0);
    expect(only(0.6, 0, 0)).toBe(1);
    expect(only(0.6, 1, 0.5)).toBeCloseTo(mix(1, Math.trunc(0.6 * 255) / 255, 0.5), 12);
  });

  it('gives the shadowmask past the fade, where the real-time shadow is gone', () => {
    expect(replace(1, 0.35, 1, 1)).toBeCloseTo(0.35, 12);
    expect(overlay(1, 0.35, 1, 1)).toBeCloseTo(0.35, 12);
  });

  it('reads a lit shadowmask as no shadow in both modes (edge case)', () => {
    expect(replace(opacityApplied(0.5, 0.8), 1, 0.2, 0.8)).toBeCloseTo(godotReplace(0.5, 1, 0.2, 0.8), 12);
    expect(overlay(1, 1, 0.5, 1)).toBeCloseTo(1, 12);
  });
});

describe('the shadowmask read', () => {
  const read = functionBody(fragment, 'float godotLightmapShadowmask');

  it('reads the alpha of the lightmap atlas, at the first layer of a slice of directional data', () => {
    expect(read).toContain('textureLod( godotLightmap, uvw, 0.0 ).a');
  });

  it('reads the alpha with the lightmap filter and the lightmap texture size', () => {
    expect(read).toContain('godotLightmapUsesBicubic ? godotShadowmaskBicubic( uvw ).x');
    expect(functionBody(fragment, 'vec3 godotShadowmaskBicubic')).toContain(
      'texture( godotLightmap, vec3( p0, uvw.z ) ).a'
    );
    expect(functionBody(fragment, 'vec3 godotShadowmaskBicubic')).toContain(
      'vec2 size = godotLightmapTextureSize;'
    );
  });

  it('is a sun shadow that replaces the fade only where the lightmap draws', () => {
    expect(functionBody(fragment, 'float godotLightmapSunShadow')).toContain(
      'if ( ! godotLightmapActive || godotShadowmaskMode == 0 ) return godotSunShadowFaded( shadow, fadeOut );'
    );
  });
});

describe('the bicubic weights', () => {
  it('sum to 1 across the four texels', () => {
    const a = 0.3;
    expect(
      weight('godotLightmapW0')(a) +
        weight('godotLightmapW1')(a) +
        weight('godotLightmapW2')(a) +
        weight('godotLightmapW3')(a)
    ).toBeCloseTo(1, 12);
  });

  it("are the cubic B-spline's at a texel centre: 1/6, 4/6, 1/6 and 0", () => {
    const atCentre = ['godotLightmapW0', 'godotLightmapW1', 'godotLightmapW2', 'godotLightmapW3'].map(
      (name) => weight(name)(0)
    );
    expect(atCentre[0]).toBeCloseTo(1 / 6, 12);
    expect(atCentre[1]).toBeCloseTo(4 / 6, 12);
    expect(atCentre[2]).toBeCloseTo(1 / 6, 12);
    expect(atCentre[3]).toBe(0);
  });

  it('offset the two taps by -1 + w1 / (w0 + w1) and 1 + w3 / (w2 + w3)', () => {
    expect(functionBody(fragment, 'float godotLightmapH0')).toContain(
      'return - 1.0 + godotLightmapW1( a ) / ( godotLightmapW0( a ) + godotLightmapW1( a ) );'
    );
    expect(functionBody(fragment, 'float godotLightmapH1')).toContain(
      'return 1.0 + godotLightmapW3( a ) / ( godotLightmapW2( a ) + godotLightmapW3( a ) );'
    );
  });
});

describe('LIGHTMAP_PROGRAM uniforms', () => {
  it('reads no lightmap for a material bound to none (edge case)', () => {
    expect(uniformsBoundTo(null).godotLightmapActive!.value).toBe(false);
  });

  it('reads the lightmap while the cull draws it', () => {
    expect(uniformsBoundTo(assignment()).godotLightmapActive!.value).toBe(true);
  });

  it('reads no lightmap the cull leaves out', () => {
    const bound = assignment();
    bound.lightmap.isDrawn = false;
    expect(uniformsBoundTo(bound).godotLightmapActive!.value).toBe(false);
  });

  it("reads the user's rect as position then size, its slice and the atlas size", () => {
    const uniforms = uniformsBoundTo(assignment());
    expect((uniforms.godotLightmapUvScale!.value as THREE.Vector4).toArray()).toEqual([
      0.25, 0.5, 0.5, 0.125,
    ]);
    expect(uniforms.godotLightmapSlice!.value).toBe(2);
    expect((uniforms.godotLightmapTextureSize!.value as THREE.Vector2).toArray()).toEqual([64, 32]);
  });

  it("turns a world normal into the LightmapGI's space by its basis transposed", () => {
    const bound = assignment();
    bound.lightmap.object.rotation.set(0, Math.PI / 2, 0);
    bound.lightmap.object.updateMatrixWorld();
    const basis = uniformsBoundTo(bound).godotLightmapNormalBasis!.value as THREE.Matrix3;
    const normal = new THREE.Vector3(1, 0, 0).applyMatrix3(basis);
    expect(normal.x).toBeCloseTo(0, 12);
    expect(normal.z).toBeCloseTo(1, 12);
  });

  it('reads the exposure scale of the lightmap, which is 1 for a material bound to none', () => {
    const bound = assignment();
    bound.lightmap.exposureScale = 2.5;
    expect(uniformsBoundTo(bound).godotLightmapExposure!.value).toBe(2.5);
    expect(uniformsBoundTo(null).godotLightmapExposure!.value).toBe(1);
  });

  it("reads the lightmap's directional data and filter", () => {
    const bound = assignment();
    bound.lightmap.usesSphericalHarmonics = true;
    bound.lightmap.usesBicubicFilter = false;
    const uniforms = uniformsBoundTo(bound);
    expect([uniforms.godotLightmapUsesSH!.value, uniforms.godotLightmapUsesBicubic!.value]).toEqual([
      true,
      false,
    ]);
  });

  it('reads the shadowmask mode the lightmap holds', () => {
    const bound = assignment();
    bound.lightmap.shadowmaskMode = ShadowmaskMode.OVERLAY;
    expect(uniformsBoundTo(bound).godotShadowmaskMode!.value).toBe(ShadowmaskMode.OVERLAY);
  });

  it('reads no shadowmask for a material bound to none (edge case)', () => {
    expect(uniformsBoundTo(null).godotShadowmaskMode!.value).toBe(ShadowmaskMode.NONE);
  });

  it('follows a rebind without a recompile', () => {
    const material = new THREE.MeshStandardMaterial();
    const { uniforms } = compiled(material);
    bindLightmap(material, assignment());
    expect(uniforms.godotLightmapActive!.value).toBe(true);
  });
});
