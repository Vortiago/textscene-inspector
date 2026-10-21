import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { surfaceDepthMaterial, syncSurfaceDepth } from './surfaceDepthMaterial';
import type { ProgramShader } from '../materialProgramInputs';
import { renderTargetMapUserData } from './renderTargetMap';
import { alphaAntialiasingUserData } from './godotAlphaAntialiasing';
import { withPointDraw } from './godotPoint';
import { AlphaAntiAliasing, scissorAntialiasing } from '../../godot/rendering/materials/alphaAntialiasing';

const SCISSOR_CUT = scissorAntialiasing(AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE, 0.5, 0.3);

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

  it('ramps the edge on the copy of an antialiased surface, as Godot’s depth draws do', () => {
    const surface = new THREE.MeshBasicMaterial({ userData: alphaAntialiasingUserData(SCISSOR_CUT) });
    const copy = surfaceDepthMaterial(surface, new THREE.MeshDepthMaterial());
    expect(compiled(copy).fragmentShader).toContain('godotEdgeCoverage(');
  });

  it('leaves alpha to coverage off on the copy, as only the colour pass turns it on', () => {
    const surface = new THREE.MeshBasicMaterial({
      alphaToCoverage: true,
      userData: alphaAntialiasingUserData(SCISSOR_CUT),
    });
    expect(surfaceDepthMaterial(surface, new THREE.MeshDepthMaterial()).alphaToCoverage).toBe(false);
  });

  describe('of a points surface', () => {
    const pointSurface = (pixels: number, pixelRatio: number) =>
      new THREE.MeshBasicMaterial({
        userData: withPointDraw(
          { materialClass: 'basic', props: {} },
          { pixels, pixelRatio, samplesAlbedoAtPointCoord: false }
        ).props.userData,
      });

    // A shadow-map texel is Godot's own, so the canvas pixel ratio does not scale it.
    it("writes the size in Godot's pixels, as the shadow map's texels", () => {
      const { vertexShader, uniforms } = compiled(
        surfaceDepthMaterial(pointSurface(20, 2), new THREE.MeshDepthMaterial())
      );
      expect(vertexShader).toContain('gl_PointSize = godotPointSize;');
      expect(uniforms.godotPointSize!.value).toBe(20);
    });

    // The alpha cut reads the albedo where the colour pass does: across the square.
    it("cuts a textured point's shadow at the point coordinate, as the colour pass reads it", () => {
      const surface = new THREE.MeshBasicMaterial({
        map: new THREE.Texture(),
        userData: withPointDraw(
          { materialClass: 'basic', props: { map: new THREE.Texture() } },
          { pixels: 20, pixelRatio: 1, samplesAlbedoAtPointCoord: true }
        ).props.userData,
      });
      const depth = surfaceDepthMaterial(surface, new THREE.MeshDepthMaterial());

      syncSurfaceDepth(depth, surface, 0.5);

      expect(compiled(depth).fragmentShader).toContain('gl_PointCoord');
    });

    it('writes no size for a surface that draws triangles (edge case)', () => {
      const copy = surfaceDepthMaterial(new THREE.MeshBasicMaterial(), new THREE.MeshDepthMaterial());
      expect(compiled(copy).vertexShader).not.toContain('gl_PointSize');
    });
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

  it('recompiles a copy whose surface starts antialiasing, with the edge ramp in its program', () => {
    const surface = new THREE.MeshBasicMaterial();
    const depth = surfaceDepthMaterial(surface, new THREE.MeshDepthMaterial());
    surface.userData = alphaAntialiasingUserData(SCISSOR_CUT);

    syncSurfaceDepth(depth, surface, 0.99);

    expect(compiled(depth).fragmentShader).toContain('godotEdgeCoverage(');
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

  it("cuts a render-target albedo where the surface samples it, through Godot's sampler", () => {
    const sampler = {
      uv: { scale: { x: 1, y: -1 }, offset: { x: 0, y: 1 } },
      repeats: true,
      isNearest: true,
    };
    const surface = new THREE.MeshBasicMaterial({
      map: new THREE.WebGLRenderTarget(4, 4).texture,
      userData: renderTargetMapUserData(sampler),
    });
    const depth = surfaceDepthMaterial(surface, new THREE.MeshDepthMaterial());

    syncSurfaceDepth(depth, surface, 0.5);

    const { vertexShader, fragmentShader } = compiled(depth);
    expect(vertexShader).toContain('godotTargetMapTransform');
    expect(fragmentShader).toContain('#define GODOT_TARGET_MAP_NEAREST');
    expect(fragmentShader).toContain('godotTargetMapSample( vMapUv )');
  });

  it('recompiles when the sampler of a render-target albedo changes', () => {
    const uv = { scale: { x: 1, y: 1 }, offset: { x: 0, y: 0 } };
    const surface = new THREE.MeshBasicMaterial({
      map: new THREE.WebGLRenderTarget(4, 4).texture,
      userData: renderTargetMapUserData({ uv, repeats: true, isNearest: false }),
    });
    const depth = surfaceDepthMaterial(surface, new THREE.MeshDepthMaterial());
    syncSurfaceDepth(depth, surface, 0.5);
    const version = depth.version;
    surface.userData = renderTargetMapUserData({ uv, repeats: false, isNearest: false });

    syncSurfaceDepth(depth, surface, 0.5);

    expect(depth.version).toBeGreaterThan(version);
    expect(compiled(depth).fragmentShader).toContain('#include <map_fragment>');
  });

  it('recompiles when the surface starts drawing points (edge case)', () => {
    const surface = new THREE.MeshBasicMaterial();
    const depth = surfaceDepthMaterial(surface, new THREE.MeshDepthMaterial());
    syncSurfaceDepth(depth, surface, 0.5);
    const version = depth.version;
    surface.userData = withPointDraw(
      { materialClass: 'basic', props: {} },
      { pixels: 20, pixelRatio: 1, samplesAlbedoAtPointCoord: false }
    ).props.userData!;

    syncSurfaceDepth(depth, surface, 0.5);

    expect(depth.version).toBeGreaterThan(version);
    expect(compiled(depth).vertexShader).toContain('gl_PointSize = godotPointSize;');
  });
});
