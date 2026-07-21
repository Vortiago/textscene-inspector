/**
 * `Environment.tonemap_mode` → three.js `WebGLRenderer.toneMapping`.
 *
 * The property was parsed and read by nothing. That is only invisible while
 * every environment uses the default: Godot's `TONE_MAPPER_LINEAR` (0) means
 * "no tone mapping", which is what we were already doing. Godot's editor
 * preview environment uses FILMIC, and rendering that as LINEAR is a measured
 * 25/255 mean channel error against a real Godot render — 20x the visual
 * goldens' threshold (`scripts/godot-ref`).
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { applyToneMapping, toneMappingFor } from './toneMapping';

describe('toneMappingFor', () => {
  it('maps every Godot tonemapper onto its three.js counterpart', () => {
    expect(toneMappingFor(0)).toBe(THREE.NoToneMapping); // LINEAR
    expect(toneMappingFor(1)).toBe(THREE.ReinhardToneMapping); // REINHARDT
    expect(toneMappingFor(2)).toBe(THREE.CineonToneMapping); // FILMIC
    expect(toneMappingFor(3)).toBe(THREE.ACESFilmicToneMapping); // ACES
    expect(toneMappingFor(4)).toBe(THREE.AgXToneMapping); // AGX
  });

  it('gives each mode a distinct curve — no two Godot modes collapse together', () => {
    const mapped = [0, 1, 2, 3, 4].map(toneMappingFor);
    expect(new Set(mapped).size).toBe(5);
  });

  it('falls back to no tone mapping for an unknown mode', () => {
    // A future Godot tonemapper must not silently inherit AgX's curve.
    expect(toneMappingFor(99)).toBe(THREE.NoToneMapping);
    expect(toneMappingFor(-1)).toBe(THREE.NoToneMapping);
  });
});

describe('applyToneMapping', () => {
  function fakeRenderer() {
    return { toneMapping: THREE.NoToneMapping, toneMappingExposure: 1 };
  }

  it('sets both the curve and the exposure on the renderer', () => {
    const gl = fakeRenderer();
    applyToneMapping(gl, { mode: 3, exposure: 1.5 });
    expect(gl.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    expect(gl.toneMappingExposure).toBe(1.5);
  });

  it('restores what it found, so an unmounting environment cannot leak its curve', () => {
    const gl = fakeRenderer();
    gl.toneMapping = THREE.ReinhardToneMapping;
    gl.toneMappingExposure = 2;

    const restore = applyToneMapping(gl, { mode: 2, exposure: 0.5 });
    expect(gl.toneMapping).toBe(THREE.CineonToneMapping);
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
    // programs keeps rendering the OLD curve until they are recompiled.
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
