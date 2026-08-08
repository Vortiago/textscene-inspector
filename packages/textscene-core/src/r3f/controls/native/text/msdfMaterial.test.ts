/**
 * `createMsdfMaterial` — the MSDF quad shader every glyph mesh shares: a
 * standard median-of-3 signed-distance decode (msdfgen's own recommended
 * technique, not a Godot port — there is no Godot GLSL source for this since
 * Godot's own TextServer draws through FreeType bitmaps, not MSDF), a
 * `distanceBias` uniform for synthesized-bold embolden, and clip planes
 * spread onto the material because three.js clipping is per-material state
 * (`ScrollContainer`'s clip hook supplies `THREE.Plane[]`; this is where they
 * must land for a glyph mesh nested inside one to actually clip).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createMsdfMaterial } from './msdfMaterial';

const RED = { r: 1, g: 0, b: 0 };

describe('createMsdfMaterial', () => {
  it('is transparent with depth write disabled, so glyph quads composite like every other 2D canvas item', () => {
    const mat = createMsdfMaterial({ map: new THREE.Texture(), color: RED, opacity: 1, pxRange: 4 });
    expect(mat.transparent).toBe(true);
    expect(mat.depthWrite).toBe(false);
  });

  it('carries the atlas texture and tint as uniforms', () => {
    const map = new THREE.Texture();
    const mat = createMsdfMaterial({ map, color: RED, opacity: 0.5, pxRange: 4 });
    expect(mat.uniforms.uMap!.value).toBe(map);
    expect((mat.uniforms.uColor!.value as THREE.Vector3).toArray()).toEqual([1, 0, 0]);
    expect(mat.uniforms.uOpacity!.value).toBe(0.5);
  });

  it('defaults distanceBias to zero (no embolden) and reflects an explicit value', () => {
    const plain = createMsdfMaterial({ map: new THREE.Texture(), color: RED, opacity: 1, pxRange: 4 });
    expect(plain.uniforms.uDistanceBias!.value).toBe(0);

    const bold = createMsdfMaterial({
      map: new THREE.Texture(),
      color: RED,
      opacity: 1,
      pxRange: 4,
      distanceBias: 0.08,
    });
    expect(bold.uniforms.uDistanceBias!.value).toBe(0.08);
  });

  it('decodes the median-of-3 MSDF channel and applies the embolden bias before thresholding', () => {
    const mat = createMsdfMaterial({ map: new THREE.Texture(), color: RED, opacity: 1, pxRange: 4 });
    expect(mat.fragmentShader).toMatch(/median/i);
    expect(mat.fragmentShader).toContain('uDistanceBias');
  });

  it('spreads supplied clipping planes onto the material (per-material state)', () => {
    const planes = [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0), new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)];
    const mat = createMsdfMaterial({
      map: new THREE.Texture(),
      color: RED,
      opacity: 1,
      pxRange: 4,
      clippingPlanes: planes,
    });
    expect(mat.clippingPlanes).toEqual(planes);
    // A fresh array, not the same reference -- a later push onto the caller's
    // array must not silently mutate an already-built material.
    expect(mat.clippingPlanes).not.toBe(planes);
  });

  it('defaults to no clipping planes when none are supplied', () => {
    const mat = createMsdfMaterial({ map: new THREE.Texture(), color: RED, opacity: 1, pxRange: 4 });
    expect(mat.clippingPlanes).toEqual([]);
  });

  it('tone maps the linear fragment BEFORE encoding it, the order every built-in material uses', () => {
    const mat = createMsdfMaterial({ map: new THREE.Texture(), color: RED, opacity: 1, pxRange: 4 });
    const tonemap = mat.fragmentShader.indexOf('#include <tonemapping_fragment>');
    const encode = mat.fragmentShader.indexOf('#include <colorspace_fragment>');
    expect(tonemap).toBeGreaterThan(-1);
    expect(encode).toBeGreaterThan(-1);
    // Reversed, the curve would run on an already-sRGB-encoded value, which a
    // plain "contains both chunks" assertion would happily accept.
    expect(tonemap).toBeLessThan(encode);
    // `tonemapping_pars_fragment` is injected by three's own fragment prefix
    // (`WebGLProgram`), never by the material: a second copy fails to compile.
    expect(mat.fragmentShader).not.toContain('tonemapping_pars_fragment');
    // three only expands `TONE_MAPPING` for a material that opts in; the
    // default is `true` and nothing here may turn it off.
    expect(mat.toneMapped).toBe(true);
  });
});
