/**
 * `Environment.tonemap_mode` → three.js `WebGLRenderer.toneMapping`. Godot's editor
 * preview environment uses FILMIC, and drawing it as LINEAR measures a 25/255 mean
 * channel error against a Godot render (`scripts/godot-ref`).
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { applyToneMapping, toneMappingFor } from './toneMapping';
import type { ToneMappedRenderer } from './toneMapping';
import {
  toneMappingEffectGlsl,
  toneMappingShaderChunk,
  toneMappingWhiteParam,
} from './godotToneMapping';

describe('toneMappingFor', () => {
  it('draws Godot\u2019s own curve for the three modes we ported', () => {
    // three's Reinhard, Cineon and ACESFilmic lack Godot's exposure bias and white
    // normalisation, so each goes through CustomToneMapping instead.
    expect(toneMappingFor(1)).toBe(THREE.CustomToneMapping); // REINHARDT
    expect(toneMappingFor(2)).toBe(THREE.CustomToneMapping); // FILMIC
    expect(toneMappingFor(3)).toBe(THREE.CustomToneMapping); // ACES
  });

  it('treats LINEAR as no tone mapping, which is what Godot means by it', () => {
    expect(toneMappingFor(0)).toBe(THREE.NoToneMapping);
  });

  it('draws AGX with Godot\u2019s own AgX, not three\u2019s different approximation', () => {
    // three's AgX (a log2 EV encoding + polynomial sigmoid) renders a
    // shallower shadow toe than Godot 4.6's allenwp curve, so AGX goes through
    // CustomToneMapping with the ported curve like the other three modes.
    expect(toneMappingFor(4)).toBe(THREE.CustomToneMapping);
  });

  it('falls back to no tone mapping for an unknown mode', () => {
    expect(toneMappingFor(99)).toBe(THREE.NoToneMapping);
    expect(toneMappingFor(-1)).toBe(THREE.NoToneMapping);
  });
});

describe('Godot\u2019s curves', () => {
  it('normalises FILMIC so white maps to 1.0', () => {
    // The whole reason three's Cineon rendered 13% dark: Godot divides by the
    // curve at white, and at the default white of 1.0 that is a 1.73x lift.
    expect(toneMappingWhiteParam(2, 1)).toBeCloseTo(0.5784, 4);
  });

  it('gives REINHARDT the squared white the shader expects', () => {
    expect(toneMappingWhiteParam(1, 3)).toBe(9);
  });

  it('normalises ACES at its own exposure bias of 1.8', () => {
    // By hand at white = 1, x = 1.8, as the rows of Godot's ACES matrices sum to 1:
    //   num = 1.8 * (1.8 + 0.0245786) - 0.000090537            = 3.284140
    //   den = 1.8 * (0.983729 * 1.8 + 0.432951) + 0.238081     = 4.204674
    //   num / den                                              = 0.781071
    expect(toneMappingWhiteParam(3, 1)).toBeCloseTo(0.781071, 5);
  });

  it('has no white parameter for LINEAR, which does not normalise', () => {
    expect(toneMappingWhiteParam(0, 4)).toBe(1);
  });

  it('gives AGX its high-clip white, floored at Godot’s 2.0', () => {
    // AgX does not divide by the curve at white; white is the shoulder's
    // high-clip point, and Godot's environment_get_white floors it at 2.0. So a
    // default white of 1 becomes 2, and a larger white passes through.
    expect(toneMappingWhiteParam(4, 1)).toBe(2);
    expect(toneMappingWhiteParam(4, 5)).toBe(5);
  });

  it('emits a compilable CustomToneMapping body that consumes the exposure', () => {
    const chunk = toneMappingShaderChunk(2);
    expect(chunk).toMatch(/vec3 CustomToneMapping\(vec3 color\)/);
    // three applies toneMappingExposure for its built-in curves only. A custom one
    // that forgets it ignores tonemap_exposure.
    expect(chunk).toMatch(/color \*= toneMappingExposure/);
  });

  it('emits an AGX body carrying Godot’s allenwp curve and matrices', () => {
    const chunk = toneMappingShaderChunk(4);
    expect(chunk).toMatch(/vec3 CustomToneMapping\(vec3 color\)/);
    expect(chunk).toMatch(/color \*= toneMappingExposure/);
    // Load-bearing AgX constants: the inset matrix's leading coefficient and the
    // middle-grey crossover the piecewise curve pivots on.
    expect(chunk).toMatch(/0\.544814746488245/);
    expect(chunk).toMatch(/awp_crossover_point = 0\.18/);
  });

  it('emits the same AGX curve on the glow-composer path, keyed on the mode', () => {
    // Both paths must tone-map AGX identically: the composer path returns the ported
    // curve, with the floored high-clip white baked in.
    const glsl = toneMappingEffectGlsl(4, 1);
    expect(glsl).toMatch(/0\.544814746488245/);
    expect(glsl).toMatch(/awp_crossover_point = 0\.18/);
    expect(glsl).toMatch(/const float godotToneMapWhite = 2\.0;/);
  });

  it('LINEAR emits a real curve that applies exposure and nothing else', () => {
    // Not a null sentinel for a consumer to fill: the builder owns all five modes.
    const glsl = toneMappingEffectGlsl(0, 1);
    expect(glsl).toContain('vec3 godotToneMap(vec3 color, float exposure)');
    expect(glsl).toContain('color *= exposure;');
    expect(glsl).toContain('return color;');
  });
});

const ORIGINAL_CHUNK = THREE.ShaderChunk.tonemapping_pars_fragment;

describe('applyToneMapping', () => {
  function fakeRenderer(): ToneMappedRenderer {
    return { toneMapping: THREE.NoToneMapping, toneMappingExposure: 1 };
  }

  it('sets both the curve and the exposure on the renderer', () => {
    const gl = fakeRenderer();
    applyToneMapping(gl, { mode: 3, exposure: 1.5 });
    expect(gl.toneMapping).toBe(THREE.CustomToneMapping);
    expect(gl.toneMappingExposure).toBe(1.5);
  });

  it('installs the curve into three\u2019s shader chunk and takes it back out', () => {
    const original = THREE.ShaderChunk.tonemapping_pars_fragment;
    const restore = applyToneMapping(fakeRenderer(), { mode: 2, exposure: 1 });
    expect(THREE.ShaderChunk.tonemapping_pars_fragment).toMatch(/exposure_bias/);
    restore();
    // The chunk is global to three; leaving a scene's curve behind would
    // change how the next scene renders.
    expect(THREE.ShaderChunk.tonemapping_pars_fragment).toBe(original);
  });

  it('bakes the white normalisation in as a valid GLSL float literal', () => {
    applyToneMapping(fakeRenderer(), { mode: 1, exposure: 1, white: 2 });
    // `4` alone is an int in GLSL and fails to compile against a float const.
    expect(THREE.ShaderChunk.tonemapping_pars_fragment).toMatch(
      /const float godotToneMapWhite = 4\.0;/
    );
    THREE.ShaderChunk.tonemapping_pars_fragment = ORIGINAL_CHUNK;
  });

  it('installs the AGX curve and bakes its floored high-clip white', () => {
    const gl = fakeRenderer();
    const restore = applyToneMapping(gl, { mode: 4, exposure: 1 });
    expect(gl.toneMapping).toBe(THREE.CustomToneMapping);
    // white defaults to 1, which Godot floors to 2.0 for AgX.
    expect(THREE.ShaderChunk.tonemapping_pars_fragment).toMatch(
      /const float godotToneMapWhite = 2\.0;/
    );
    expect(THREE.ShaderChunk.tonemapping_pars_fragment).toMatch(/awp_crossover_point = 0\.18/);
    restore();
    expect(THREE.ShaderChunk.tonemapping_pars_fragment).toBe(ORIGINAL_CHUNK);
  });

  it('restores what it found, so an unmounting environment cannot leak its curve', () => {
    const gl = fakeRenderer();
    gl.toneMapping = THREE.ReinhardToneMapping;
    gl.toneMappingExposure = 2;

    const restore = applyToneMapping(gl, { mode: 2, exposure: 0.5 });
    expect(gl.toneMapping).toBe(THREE.CustomToneMapping);
    restore();

    expect(gl.toneMapping).toBe(THREE.ReinhardToneMapping);
    expect(gl.toneMappingExposure).toBe(2);
  });

  it('treats a missing exposure as Godot’s 1.0 default rather than leaving the old one', () => {
    const gl = fakeRenderer();
    gl.toneMappingExposure = 4;
    applyToneMapping(gl, { mode: 0 });
    expect(gl.toneMappingExposure).toBe(1);
  });

  it('marks the materials dirty — three compiles the tonemapper into every shader', () => {
    // toneMapping is a #define, so a renderer that already has compiled
    // programs keeps rendering the old curve until they are recompiled.
    // `needsUpdate` is setter-only in three; the observable effect is the
    // material's version counter, which is what drives recompilation.
    const scene = new THREE.Scene();
    const material = new THREE.MeshStandardMaterial();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
    const before = material.version;

    applyToneMapping(fakeRenderer(), { mode: 3, exposure: 1 }, scene);
    expect(material.version).toBeGreaterThan(before);
  });

  it('does not churn material versions when the curve is unchanged', () => {
    const scene = new THREE.Scene();
    const material = new THREE.MeshStandardMaterial();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
    const before = material.version;

    applyToneMapping(fakeRenderer(), { mode: 0, exposure: 1 }, scene);
    expect(material.version).toBe(before);
  });

  it('leaves the renderer alone when nothing changes', () => {
    const gl = fakeRenderer();
    const spy = vi.fn();
    Object.defineProperty(gl, 'toneMapping', {
      get: () => THREE.NoToneMapping,
      set: spy,
      configurable: true,
    });
    applyToneMapping(gl, { mode: 0, exposure: 1 });
    expect(spy).not.toHaveBeenCalled();
  });
});
