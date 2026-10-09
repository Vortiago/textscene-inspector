import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  cutBlends,
  cutFadeVariants,
  cutOpaquePrepasses,
  surfaceFadeVariants,
  type AlphaPassSurface,
} from './fadeVariants';
import { DRAWN_OPAQUE_PREPASS, FADED_OPAQUE_PREPASS, NO_OPAQUE_PREPASS } from './opaquePrepass';
import type { SurfaceAlphaSource } from './surfaceAlphaPatch';
import { alphaCutSurface } from '../godotAlphaCut';
import { AlphaCutMode } from '../../nodes/3d/sprite3d/types';
import { DROPS_ALBEDO_ALPHA, patchedShader } from '../testing/patchedFragment';

const READS_ALBEDO: SurfaceAlphaSource = { readsAlbedoAlpha: true, opaqueAfterCut: false };
const CUT: SurfaceAlphaSource = { readsAlbedoAlpha: true, opaqueAfterCut: true };

const OPAQUE_SURFACE: AlphaPassSurface = {
  opacity: 1,
  transparent: false,
  depthWrite: true,
  alphaPassDepthWrite: false,
};

describe('surfaceFadeVariants', () => {
  it('leaves the surface as it is unfaded', () => {
    expect(surfaceFadeVariants(READS_ALBEDO, OPAQUE_SURFACE).unfaded).toEqual({
      opacity: 1,
      transparent: false,
      depthWrite: true,
    });
  });

  it('keeps the surface opacity in the alpha pass, for the cull to scale', () => {
    const surface = { ...OPAQUE_SURFACE, opacity: 0.5, transparent: true };
    expect(surfaceFadeVariants(READS_ALBEDO, surface).alphaPass.opacity).toBe(0.5);
  });

  it('moves an opaque surface to the blended pass', () => {
    expect(surfaceFadeVariants(READS_ALBEDO, OPAQUE_SURFACE).alphaPass.transparent).toBe(true);
  });

  it('writes no depth in the alpha pass by default', () => {
    expect(surfaceFadeVariants(READS_ALBEDO, OPAQUE_SURFACE).alphaPass.depthWrite).toBe(false);
  });

  it("writes depth in the alpha pass where the surface's depth draw mode says so", () => {
    const surface = { ...OPAQUE_SURFACE, alphaPassDepthWrite: true };
    expect(surfaceFadeVariants(READS_ALBEDO, surface).alphaPass.depthWrite).toBe(true);
  });

  it('reads the blend props from the alpha-pass state (edge case)', () => {
    const { unfaded, alphaPass } = surfaceFadeVariants(CUT, OPAQUE_SURFACE);
    expect([unfaded.blending, alphaPass.blending]).toEqual([undefined, THREE.NoBlending]);
  });
});

/** A Sprite3D discard cut at 0.5, with or without FLAG_TRANSPARENT. */
function discardCut(transparentFlag: boolean) {
  return alphaCutSurface({ mode: AlphaCutMode.ALPHA_CUT_DISCARD, scissorThreshold: 0.5, transparentFlag });
}

describe('cutBlends', () => {
  it('keeps the cut of the surface in both passes', () => {
    const { unfaded, alphaPass } = cutBlends(discardCut(true));
    expect([unfaded, alphaPass]).toMatchObject([
      { alphaTest: 0.5, alphaHash: false },
      { alphaTest: 0.5, alphaHash: false },
    ]);
  });

  it('adds nothing to a cut surface in the opaque pass', () => {
    expect(cutBlends(discardCut(true)).unfaded).not.toHaveProperty('blending');
  });

  it('writes no depth in the alpha pass', () => {
    expect(cutBlends(discardCut(true)).alphaPass).toMatchObject({
      transparent: true,
      depthWrite: false,
    });
  });

  it('writes alpha 1 past the cut in the alpha pass, as Godot does', () => {
    expect(cutBlends(discardCut(true)).alphaPass.blending).toBe(THREE.NoBlending);
  });

  it('drops the texture alpha of a sprite without FLAG_TRANSPARENT in the alpha pass (edge case)', () => {
    const { injection } = cutBlends(discardCut(false)).alphaPass;
    expect(patchedShader(injection!.onBeforeCompile, THREE.ShaderLib.basic.fragmentShader)).toContain(
      DROPS_ALBEDO_ALPHA
    );
  });
});

describe('cutFadeVariants', () => {
  it('gives both passes the opacity the sprite shader reads', () => {
    const { unfaded, alphaPass } = cutFadeVariants(discardCut(true), 0.25);
    expect([unfaded.opacity, alphaPass.opacity]).toEqual([0.25, 0.25]);
  });

  it('keeps the blends of the cut', () => {
    expect(cutFadeVariants(discardCut(true), 1).alphaPass.blending).toBe(THREE.NoBlending);
  });

  it('carries an opacity of 0, which a fully transparent modulate gives (edge case)', () => {
    expect(cutFadeVariants(discardCut(true), 0).unfaded.opacity).toBe(0);
  });
});

describe('cutOpaquePrepasses', () => {
  const prepassCut = alphaCutSurface({
    mode: AlphaCutMode.ALPHA_CUT_OPAQUE_PREPASS,
    scissorThreshold: 0.5,
    transparentFlag: true,
  });

  it('has the depth prepass draw the unfaded pass and only cut the faded one', () => {
    // A fade below 0.999 forces the alpha pass (`render_forward_clustered.cpp:1128-1134`).
    expect(cutOpaquePrepasses(prepassCut, true)).toEqual({
      unfaded: DRAWN_OPAQUE_PREPASS,
      alphaPass: FADED_OPAQUE_PREPASS,
    });
  });

  it('gives a cut with no depth prepass none in either pass', () => {
    expect(cutOpaquePrepasses(discardCut(true), true)).toEqual({
      unfaded: NO_OPAQUE_PREPASS,
      alphaPass: NO_OPAQUE_PREPASS,
    });
  });

  it('gives a surface with no depth test none (edge case)', () => {
    expect(cutOpaquePrepasses(prepassCut, false).unfaded).toBe(NO_OPAQUE_PREPASS);
  });
});
