import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { surfaceDepthMaterial, syncSurfaceDepth } from './surfaceDepthMaterial';
import type { ProgramShader } from '../materialProgramInputs';

/** The depth program as `depth`'s `onBeforeCompile` leaves it. */
function compiled(depth: THREE.Material): ProgramShader {
  const shader: ProgramShader = { ...THREE.ShaderLib.depth, uniforms: {} };
  depth.onBeforeCompile.call(depth, shader as THREE.WebGLProgramParametersWithUniforms, undefined as never);
  return shader;
}

describe('surfaceDepthMaterial', () => {
  it('keeps one copy of a base per surface', () => {
    const surface = new THREE.MeshBasicMaterial();
    const base = new THREE.MeshDepthMaterial();
    expect(surfaceDepthMaterial(surface, base)).toBe(surfaceDepthMaterial(surface, base));
  });

  it("keeps the base's class and packing", () => {
    const base = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    expect(surfaceDepthMaterial(new THREE.MeshBasicMaterial(), base)).toMatchObject({
      type: 'MeshDepthMaterial',
      depthPacking: THREE.RGBADepthPacking,
    });
  });

  it('cuts the alpha the surface draws: opacity, then texture, then vertex colour', () => {
    const { fragmentShader } = compiled(
      surfaceDepthMaterial(new THREE.MeshBasicMaterial(), new THREE.MeshDepthMaterial())
    );
    expect(fragmentShader).toMatch(
      /diffuseColor\.a = opacity;\s*#include <map_fragment>\s*#include <color_fragment>/
    );
  });

  it('hashes the copy of a hashed surface', () => {
    const surface = new THREE.MeshBasicMaterial({ alphaHash: true });
    const copy = surfaceDepthMaterial(surface, new THREE.MeshDistanceMaterial());
    expect(copy.alphaHash).toBe(true);
    expect(compiled(copy).fragmentShader).toContain('godotAlphaHashScale');
  });

  it('disposes its copies with the surface (edge case)', () => {
    const surface = new THREE.MeshBasicMaterial();
    const base = new THREE.MeshDepthMaterial();
    const copy = surfaceDepthMaterial(surface, base);
    let disposed = false;
    copy.addEventListener('dispose', () => (disposed = true));

    surface.dispose();

    expect(disposed).toBe(true);
    expect(surfaceDepthMaterial(surface, base)).not.toBe(copy);
  });
});

describe('syncSurfaceDepth', () => {
  it("gives the copy the surface's alpha state, cut where the caller says", () => {
    const map = new THREE.Texture();
    const surface = new THREE.MeshBasicMaterial({ map, opacity: 0.4, vertexColors: true, alphaTest: 0.2 });
    const depth = surfaceDepthMaterial(surface, new THREE.MeshDepthMaterial());

    syncSurfaceDepth(depth, surface, 0.99);

    expect(depth).toMatchObject({ map, opacity: 0.4, vertexColors: true, alphaTest: 0.99 });
  });

  it('recompiles when a slot the program keys on appears', () => {
    const surface = new THREE.MeshBasicMaterial();
    const depth = surfaceDepthMaterial(surface, new THREE.MeshDepthMaterial());
    const version = depth.version;
    surface.alphaMap = new THREE.Texture();

    syncSurfaceDepth(depth, surface, 0.5);

    expect(depth.version).toBeGreaterThan(version);
  });

  it('recompiles a copy whose surface starts hashing, with the hash in its program', () => {
    const surface = new THREE.MeshBasicMaterial();
    const depth = surfaceDepthMaterial(surface, new THREE.MeshDepthMaterial());
    surface.alphaHash = true;

    syncSurfaceDepth(depth, surface, 0);

    expect(depth.alphaHash).toBe(true);
    expect(compiled(depth).fragmentShader).toContain('godotAlphaHashScale');
  });

  it('leaves the program alone when only a value moves (edge case)', () => {
    const surface = new THREE.MeshBasicMaterial();
    const depth = surfaceDepthMaterial(surface, new THREE.MeshDepthMaterial());
    syncSurfaceDepth(depth, surface, 0.5);
    const version = depth.version;
    surface.opacity = 0.3;

    syncSurfaceDepth(depth, surface, 0.1);

    expect(depth.version).toBe(version);
  });
});
