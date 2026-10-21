/**
 * `BaseMaterial3D::get_material_for_2d` (`scene/resources/material.cpp:3021`), the one material
 * Sprite3D and Label3D both build. Expected values are read off the arms it selects.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { materialFor2d, type MaterialFor2dInput } from './materialFor2d';
import { NO_TRANSPARENT_FLAG } from './godotAlphaCut';
import { AlphaCutMode } from '../godot/rendering/materials/alphaCut';
import { AlphaAntiAliasing } from '../godot/rendering/materials/alphaAntialiasing';
import { TextureFilter } from '../godot/rendering/materials/textureFilter';

const DEFAULTS: MaterialFor2dInput = {
  alphaCut: AlphaCutMode.DISABLED,
  alphaScissorThreshold: 0.5,
  transparentFlag: true,
  alphaHashScale: 1,
  alphaAntialiasingMode: AlphaAntiAliasing.ALPHA_ANTIALIASING_OFF,
  alphaAntialiasingEdge: 0,
  doubleSided: true,
  noDepthTest: false,
  textureFilter: TextureFilter.LINEAR_WITH_MIPMAPS,
};

const materialWith = (overrides: Partial<MaterialFor2dInput>) => materialFor2d({ ...DEFAULTS, ...overrides });

describe('materialFor2d alpha cut', () => {
  it('DISABLED blends both passes, writes no depth and leaves the shadow pass', () => {
    const { blends, joinsShadowPass } = materialWith({ alphaCut: AlphaCutMode.DISABLED });
    expect(blends.unfaded).toMatchObject({
      transparent: true,
      depthWrite: false,
      alphaTest: 0,
      alphaHash: false,
    });
    expect(blends.alphaPass).toMatchObject({ transparent: true, depthWrite: false });
    expect(joinsShadowPass).toBe(false);
  });

  it('DISCARD scissors at the threshold and draws opaque', () => {
    const { blends } = materialWith({ alphaCut: AlphaCutMode.DISCARD, alphaScissorThreshold: 0.25 });
    expect(blends.unfaded).toMatchObject({ transparent: false, depthWrite: true, alphaTest: 0.25 });
  });

  it('OPAQUE_PREPASS blends, and a fade into the alpha pass leaves only its shadow cut', () => {
    const { blends, joinsShadowPass } = materialWith({ alphaCut: AlphaCutMode.OPAQUE_PREPASS });
    expect(blends.unfaded).toMatchObject({ transparent: true, depthWrite: false });
    expect(blends.unfaded.opaquePrepass).toEqual({ cutsDepth: true, drawsPrepass: true });
    expect(blends.alphaPass.opaquePrepass).toEqual({ cutsDepth: true, drawsPrepass: false });
    expect(joinsShadowPass).toBe(true);
  });

  it('OPAQUE_PREPASS loses its prepass when the depth test is off', () => {
    const { blends, joinsShadowPass } = materialWith({
      alphaCut: AlphaCutMode.OPAQUE_PREPASS,
      noDepthTest: true,
    });
    expect(blends.unfaded.opaquePrepass).toEqual({ cutsDepth: false, drawsPrepass: false });
    expect(joinsShadowPass).toBe(false);
  });

  it('HASH cuts stochastically and draws opaque', () => {
    const { blends } = materialWith({ alphaCut: AlphaCutMode.HASH });
    expect(blends.unfaded).toMatchObject({
      transparent: false,
      depthWrite: true,
      alphaHash: true,
      alphaTest: 0,
    });
  });

  it('a Label3D flag never disables the switch', () => {
    const { blends } = materialWith({ alphaCut: AlphaCutMode.DISCARD, transparentFlag: NO_TRANSPARENT_FLAG });
    expect(blends.unfaded.alphaTest).toBe(0.5);
  });

  it('a Sprite3D with the transparent flag off draws opaque and uncut', () => {
    const { blends } = materialWith({ alphaCut: AlphaCutMode.DISCARD, transparentFlag: false });
    expect(blends.unfaded).toMatchObject({ transparent: false, depthWrite: true, alphaTest: 0 });
  });

  it('hands every pass the alpha hash scale', () => {
    const { blends } = materialWith({ alphaCut: AlphaCutMode.HASH, alphaHashScale: 2.5 });
    expect([blends.unfaded.alphaHashScale, blends.alphaPass.alphaHashScale]).toEqual([2.5, 2.5]);
  });

  it('hands every pass the alpha antialiasing of a scissor cut', () => {
    const { blends } = materialWith({
      alphaCut: AlphaCutMode.DISCARD,
      alphaScissorThreshold: 0.5,
      alphaAntialiasingMode: AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE,
      alphaAntialiasingEdge: 0.25,
    });
    expect(blends.unfaded.antialiasing).toEqual({
      mode: AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE,
      scissorThreshold: 0.5,
      edge: 0.75,
    });
    expect(blends.alphaPass.antialiasing).toBe(blends.unfaded.antialiasing);
  });
});

describe('materialFor2d side and depth test', () => {
  it('draws both faces unless double_sided is off', () => {
    expect(materialWith({ doubleSided: true }).side).toBe(THREE.DoubleSide);
    expect(materialWith({ doubleSided: undefined }).side).toBe(THREE.DoubleSide);
    expect(materialWith({ doubleSided: false }).side).toBe(THREE.FrontSide);
  });

  it('reports the depth test the flag leaves', () => {
    expect(materialWith({ noDepthTest: false }).depthTest).toBe(true);
    expect(materialWith({ noDepthTest: true }).depthTest).toBe(false);
  });
});

describe('materialFor2d texture filter', () => {
  it.each([
    [TextureFilter.NEAREST, THREE.NearestFilter],
    [TextureFilter.LINEAR, THREE.LinearFilter],
    [TextureFilter.NEAREST_WITH_MIPMAPS, THREE.NearestFilter],
    [TextureFilter.LINEAR_WITH_MIPMAPS, THREE.LinearFilter],
    [TextureFilter.NEAREST_WITH_MIPMAPS_ANISOTROPIC, THREE.NearestFilter],
    [TextureFilter.LINEAR_WITH_MIPMAPS_ANISOTROPIC, THREE.LinearFilter],
  ])('filter %i samples with magFilter %i', (textureFilter, magFilter) => {
    expect(materialWith({ textureFilter }).textureFilter.magFilter).toBe(magFilter);
  });
});
