/**
 * The lightmap's read in three's lit programs, against Godot's in
 * `scene_forward_clustered.glsl:921-978` and `:1835-1876`.
 */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { ProgramShader } from '../materialProgramInputs';
import { functionBody } from '../testing/glslSource';
import { scalarGlslFunction } from '../testing/glslScalar';
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
    expect(functionBody(fragment, 'vec3 godotLightmapAmbient')).toContain(
      'vec3 uvw = vec3( vGodotLightmapUv * godotLightmapUvScale.zw + godotLightmapUvScale.xy, godotLightmapSlice );'
    );
  });

  it('reads four layers per slice of directional data, and lights the L1 bands along the normal', () => {
    const ambient = functionBody(fragment, 'vec3 godotLightmapAmbient');
    expect(ambient).toContain('uvw.z *= 4.0;');
    expect(ambient).toContain(
      'return l0 + l1n1 * n.y * ( l0 * 4.0 ) + l1z * n.z * ( l0 * 4.0 ) + l1p1 * n.x * ( l0 * 4.0 );'
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

  it('follows a rebind without a recompile', () => {
    const material = new THREE.MeshStandardMaterial();
    const { uniforms } = compiled(material);
    bindLightmap(material, assignment());
    expect(uniforms.godotLightmapActive!.value).toBe(true);
  });
});
