import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { cutSurfaceAlpha, fadedSurfaceAlpha, type AlphaPassSurface } from './fadedSurfaceAlpha';
import type { SurfaceAlphaSource } from './surfaceAlphaPatch';
import { alphaCutSurface } from '../godotAlphaCut';
import { AlphaCutMode } from '../../nodes/3d/sprite3d/types';
import { HALF_FADE_ALPHA } from '../testing/halfFadeAlpha';
import { DROPS_ALBEDO_ALPHA, patchedShader } from '../testing/patchedFragment';

const READS_ALBEDO: SurfaceAlphaSource = { readsAlbedoAlpha: true, opaqueAfterCut: false };
const CUT: SurfaceAlphaSource = { readsAlbedoAlpha: true, opaqueAfterCut: true };

const OPAQUE_SURFACE: AlphaPassSurface = {
  opacity: 1,
  transparent: false,
  depthWrite: true,
  alphaPassDepthWrite: false,
};

describe('fadedSurfaceAlpha', () => {
  it('leaves the surface as it is for an opaque geometry instance', () => {
    expect(fadedSurfaceAlpha(READS_ALBEDO, OPAQUE_SURFACE, 0)).toEqual({
      opacity: 1,
      transparent: false,
      depthWrite: true,
    });
  });

  it('multiplies the fade alpha into the surface opacity', () => {
    const surface = { ...OPAQUE_SURFACE, opacity: 0.5, transparent: true };
    expect(fadedSurfaceAlpha(READS_ALBEDO, surface, 0.3).opacity).toBe((0.5 * 178) / 255);
  });

  it('moves an opaque surface to the blended pass', () => {
    expect(fadedSurfaceAlpha(READS_ALBEDO, OPAQUE_SURFACE, 0.3).transparent).toBe(true);
  });

  it('writes no depth in the alpha pass by default', () => {
    expect(fadedSurfaceAlpha(READS_ALBEDO, OPAQUE_SURFACE, 0.3).depthWrite).toBe(false);
  });

  it("writes depth in the alpha pass where the surface's depth draw mode says so", () => {
    expect(
      fadedSurfaceAlpha(READS_ALBEDO, { ...OPAQUE_SURFACE, alphaPassDepthWrite: true }, 0.3).depthWrite
    ).toBe(true);
  });

  it('reads the blend props from the faded state', () => {
    expect(fadedSurfaceAlpha(CUT, OPAQUE_SURFACE, 0.5).blending).toBe(THREE.NoBlending);
  });
});

/** A Sprite3D discard cut at 0.5, with or without FLAG_TRANSPARENT. */
function discardCut(transparentFlag: boolean) {
  return alphaCutSurface({ mode: AlphaCutMode.ALPHA_CUT_DISCARD, scissorThreshold: 0.5, transparentFlag });
}

describe('cutSurfaceAlpha', () => {
  it('keeps the cut of the surface', () => {
    expect(cutSurfaceAlpha(discardCut(true), 1, 0)).toMatchObject({ alphaTest: 0.5, alphaHash: false });
  });

  it('adds nothing to a cut surface in the opaque pass', () => {
    expect(cutSurfaceAlpha(discardCut(true), 1, 0)).not.toHaveProperty('blending');
  });

  it('writes no depth in the alpha pass', () => {
    expect(cutSurfaceAlpha(discardCut(true), 1, 0.5)).toMatchObject({
      transparent: true,
      depthWrite: false,
      opacity: HALF_FADE_ALPHA,
    });
  });

  it('writes alpha 1 past the cut once the fade alpha blends it, as Godot does', () => {
    expect(cutSurfaceAlpha(discardCut(true), 1, 0.5).blending).toBe(THREE.NoBlending);
  });

  it('drops the texture alpha of a sprite without FLAG_TRANSPARENT once the fade alpha blends it', () => {
    const { injection } = cutSurfaceAlpha(discardCut(false), 1, 0.5);
    expect(patchedShader(injection!.onBeforeCompile, THREE.ShaderLib.basic.fragmentShader)).toContain(
      DROPS_ALBEDO_ALPHA
    );
  });
});
