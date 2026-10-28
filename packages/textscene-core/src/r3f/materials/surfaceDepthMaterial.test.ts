import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { surfaceDepthMaterial, syncSurfaceDepth } from './surfaceDepthMaterial';
import type { ProgramShader } from '../materialProgramInputs';
import { alphaAntialiasingUserData } from './godotAlphaAntialiasing';
import { withPointDraw } from './godotPoint';
import { AlphaAntiAliasing, scissorAntialiasing } from '../../godot/rendering/materials/alphaAntialiasing';

const SCISSOR_CUT = scissorAntialiasing(AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE, 0.5, 0.3);

/** The depth or distance program as `depth`'s `onBeforeCompile` leaves it. */
function compiled(depth: THREE.MeshDepthMaterial | THREE.MeshDistanceMaterial): ProgramShader {
  const base = depth instanceof THREE.MeshDistanceMaterial ? THREE.ShaderLib.distance : THREE.ShaderLib.depth;
  const shader: ProgramShader = { ...base, uniforms: {} };
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

  // three's distance fragment declares no `opacity`, so a copy that reads it fails to link and draws nothing.
  it('declares the opacity a distance copy reads', () => {
    const { fragmentShader } = compiled(
      surfaceDepthMaterial(new THREE.MeshBasicMaterial(), new THREE.MeshDistanceMaterial())
    );
    expect(fragmentShader).toMatch(
      /#ifdef DISTANCE\s*uniform float opacity;\s*#endif[\s\S]*diffuseColor\.a = opacity;/
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
