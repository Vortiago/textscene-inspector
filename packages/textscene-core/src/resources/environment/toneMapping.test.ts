/**
 * The root world's tone mapping through three's per-material hook, which must draw the curve the
 * compositor's tone pass draws. Godot multiplies by `tonemap_exposure` before every curve, LINEAR
 * included (`tonemap.glsl:868-874`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { installToneMapping } from './toneMapping';
import { compositeProgram } from './godotCompositor';
import { ToneMapper } from '../../godot/rendering/environment/toneMapping.js';
import { functionBody } from '../../r3f/testing/glslSource';
import { scalarGlslFunction } from '../../r3f/testing/glslScalar';

const ORIGINAL_CHUNK = THREE.ShaderChunk.tonemapping_pars_fragment;
const { LINEAR, REINHARDT, FILMIC, ACES, AGX } = ToneMapper;
const EVERY_MODE = [LINEAR, REINHARDT, FILMIC, ACES, AGX];

type Renderer = Parameters<typeof installToneMapping>[0];

function fakeRenderer(): Renderer {
  return { toneMapping: THREE.NoToneMapping, toneMappingExposure: 1 };
}

function installedChunk(): string {
  return THREE.ShaderChunk.tonemapping_pars_fragment;
}

/**
 * A grey `x` through the installed `CustomToneMapping` at the renderer's exposure. Only a curve
 * that acts per channel translates: LINEAR, REINHARDT and FILMIC.
 */
function greyThroughInstalledCurve(gl: Renderer, x: number): number {
  const body = functionBody(installedChunk(), 'vec3 CustomToneMapping')
    .replace(/vec3\(/g, '(')
    .replace(/vec3/g, 'float')
    .replace(/const float/g, 'const');
  const curve = scalarGlslFunction(`float curve(float color, float toneMappingExposure) {${body}}`, 'curve');
  return curve(x, gl.toneMappingExposure);
}

/** The curve's lines after its exposure line, which the compositor applies before the call. */
function curveAfterExposure(body: string): string {
  return body.slice(body.indexOf(';') + 1);
}

afterEach(() => {
  THREE.ShaderChunk.tonemapping_pars_fragment = ORIGINAL_CHUNK;
});

describe('installToneMapping', () => {
  it('draws every tone mapper, LINEAR included, through the installed curve', () => {
    for (const mode of EVERY_MODE) {
      const gl = fakeRenderer();
      installToneMapping(gl, { mode });
      expect(gl.toneMapping, `mode ${mode}`).toBe(THREE.CustomToneMapping);
    }
  });

  it('doubles a LINEAR grey at tonemap_exposure 2.0', () => {
    const gl = fakeRenderer();
    installToneMapping(gl, { mode: LINEAR, exposure: 2 });
    expect(greyThroughInstalledCurve(gl, 0.2)).toBeCloseTo(0.4, 12);
  });

  it('maps the authored white to 1.0 under REINHARDT and FILMIC', () => {
    for (const mode of [REINHARDT, FILMIC]) {
      const gl = fakeRenderer();
      installToneMapping(gl, { mode, white: 6 });
      expect(greyThroughInstalledCurve(gl, 6), `mode ${mode}`).toBeCloseTo(1, 6);
    }
  });

  it('clamps a negative colour to black before a curve, as Godot does', () => {
    // `tonemap.glsl:256-258`: a negative light must not drive a curve below its toe.
    const gl = fakeRenderer();
    installToneMapping(gl, { mode: FILMIC });
    expect(greyThroughInstalledCurve(gl, -0.5)).toBe(greyThroughInstalledCurve(gl, 0));
  });

  it('keeps a negative colour under LINEAR, which applies no curve', () => {
    const gl = fakeRenderer();
    installToneMapping(gl, { mode: LINEAR });
    expect(greyThroughInstalledCurve(gl, -0.5)).toBe(-0.5);
  });

  it('draws a mode outside the enum white, as Godot does (error path)', () => {
    const gl = fakeRenderer();
    installToneMapping(gl, { mode: 99, exposure: 2 });
    expect(greyThroughInstalledCurve(gl, 0.2)).toBe(1);
  });

  it('takes a missing exposure as Godot’s 1.0 default, not the renderer’s old one', () => {
    const gl = fakeRenderer();
    gl.toneMappingExposure = 4;
    installToneMapping(gl, { mode: LINEAR });
    expect(gl.toneMappingExposure).toBe(1);
  });

  it('restores the mapping, the exposure and three’s chunk', () => {
    const gl = fakeRenderer();
    gl.toneMapping = THREE.ReinhardToneMapping;
    gl.toneMappingExposure = 2;
    installToneMapping(gl, { mode: FILMIC, exposure: 0.5 })();
    expect(gl.toneMapping).toBe(THREE.ReinhardToneMapping);
    expect(gl.toneMappingExposure).toBe(2);
    expect(installedChunk()).toBe(ORIGINAL_CHUNK);
  });

  it('bakes the white normalisation in as a GLSL float literal', () => {
    // `4` alone is an int in GLSL and fails to compile against a float const.
    installToneMapping(fakeRenderer(), { mode: REINHARDT, white: 2 });
    expect(installedChunk()).toContain('const float godotToneMapWhite = 4.0;');
  });

  it('marks the materials dirty on install and on restore, as three compiles the curve in', () => {
    // `needsUpdate` is setter-only in three. The version counter is what re-derives the program.
    const scene = new THREE.Scene();
    const material = new THREE.MeshStandardMaterial();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
    const before = material.version;
    const restore = installToneMapping(fakeRenderer(), { mode: LINEAR }, scene);
    const installed = material.version;
    restore();
    expect(installed).toBeGreaterThan(before);
    expect(material.version).toBeGreaterThan(installed);
  });
});

describe('the curve in three’s chunk', () => {
  it('declares the exposure uniform and the hook once each, as GLSL needs', () => {
    installToneMapping(fakeRenderer(), { mode: FILMIC });
    expect(installedChunk().match(/uniform float toneMappingExposure;/g)).toHaveLength(1);
    expect(installedChunk().match(/vec3 CustomToneMapping\(/g)).toHaveLength(1);
  });

  it('warns and keeps the chunk when three holds no CustomToneMapping stub (error case)', async () => {
    // The module reads three's chunk when it loads, so the chunk is set before a fresh import.
    // The fresh install chains its key onto the prototype's, so the test puts the key back.
    const programKey = THREE.Material.prototype.customProgramCacheKey;
    vi.resetModules();
    const three = await import('three');
    const { warningsOf } = await import('../../r3f/testing/logWarnings');
    const withoutStub = 'vec3 OtherToneMapping( vec3 color ) { return color; }';
    three.ShaderChunk.tonemapping_pars_fragment = withoutStub;
    const { installToneMapping: installFresh } = await import('./toneMapping');

    const warnings = warningsOf(() => installFresh(fakeRenderer(), { mode: FILMIC }));
    THREE.Material.prototype.customProgramCacheKey = programKey;

    expect(warnings).toHaveLength(1);
    expect(three.ShaderChunk.tonemapping_pars_fragment).toBe(withoutStub);
  });
});

describe('the compositor’s tone pass', () => {
  it('draws the curve three installs, for every tone mapper', () => {
    for (const mode of EVERY_MODE) {
      const toneMapping = { mode, white: 6, agxContrast: 1.6 };
      installToneMapping(fakeRenderer(), toneMapping);
      const composite = compositeProgram({
        glow: null,
        adjustments: null,
        autoExposure: null,
        toneMapping,
        exposure: 1,
        transparentBackground: false,
        usesBicubicGlowUpscale: true,
      }).fragmentShader;
      expect(functionBody(composite, 'vec3 godotToneMap'), `mode ${mode}`).toBe(
        curveAfterExposure(functionBody(installedChunk(), 'vec3 CustomToneMapping'))
      );
    }
  });
});

describe('installToneMapping program keys', () => {
  // three reuses a compiled program whose key is equal, so a new curve reaches a material that
  // has compiled only when the key changes with the curve. FILMIC then AGX is the editor preview
  // environment yielding to a WorldEnvironment that an instanced sub-scene brings in.

  /** Each material's key under FILMIC, then under AGX after FILMIC is undone. */
  function keysAcrossSwap(...materials: THREE.Material[]): { filmic: string[]; agx: string[] } {
    const gl = fakeRenderer();
    const restoreFilmic = installToneMapping(gl, { mode: FILMIC });
    const filmic = materials.map((material) => material.customProgramCacheKey());
    restoreFilmic();
    installToneMapping(gl, { mode: AGX });
    return { filmic, agx: materials.map((material) => material.customProgramCacheKey()) };
  }

  it('gives a tone-mapped material a new program key when AGX replaces FILMIC', () => {
    const { filmic, agx } = keysAcrossSwap(new THREE.MeshStandardMaterial());
    expect(agx[0]).not.toBe(filmic[0]);
  });

  it('gives an equal chunk the same key when it is installed again', () => {
    const material = new THREE.MeshBasicMaterial();
    installToneMapping(fakeRenderer(), { mode: AGX });
    const first = material.customProgramCacheKey();
    installToneMapping(fakeRenderer(), { mode: FILMIC });
    installToneMapping(fakeRenderer(), { mode: AGX });
    expect(material.customProgramCacheKey()).toBe(first);
  });

  it('re-keys a sky background material, which the renderer owns and no scene holds', () => {
    const { vertexShader, fragmentShader } = THREE.ShaderLib.backgroundCube!;
    const { filmic, agx } = keysAcrossSwap(new THREE.ShaderMaterial({ vertexShader, fragmentShader }));
    expect(agx[0]).not.toBe(filmic[0]);
  });

  it('re-keys only the materials that compile the curve', () => {
    const { filmic, agx } = keysAcrossSwap(
      new THREE.MeshBasicMaterial(),
      new THREE.MeshBasicMaterial({ toneMapped: false })
    );
    expect(agx[0]).not.toBe(filmic[0]);
    expect(agx[1]).toBe(filmic[1]);
  });

  it('gives the replaced curve its key back on restore, so its programs are reused', () => {
    const material = new THREE.MeshStandardMaterial();
    const gl = fakeRenderer();
    const restoreFilmic = installToneMapping(gl, { mode: FILMIC });
    const underFilmic = material.customProgramCacheKey();
    const restoreAgx = installToneMapping(gl, { mode: AGX });
    const underAgx = material.customProgramCacheKey();
    restoreAgx();

    expect(underAgx).not.toBe(underFilmic);
    expect(material.customProgramCacheKey()).toBe(underFilmic);
    restoreFilmic();
  });

  it('keeps three’s own key, so two shader patches still compile two programs', () => {
    installToneMapping(fakeRenderer(), { mode: AGX });
    const tinted = new THREE.MeshStandardMaterial();
    tinted.onBeforeCompile = (shader) => {
      shader.fragmentShader += '\n// tinted';
    };
    const plain = new THREE.MeshStandardMaterial();
    expect(tinted.customProgramCacheKey()).not.toBe(plain.customProgramCacheKey());
  });
});
