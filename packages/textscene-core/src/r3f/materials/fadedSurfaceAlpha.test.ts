import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { standardMaterialBag, bagAlphaProps } from '../../resources/materials/standardmaterial3d/materialBag';
import { parseStandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/scalars';
import { alphaCutSurface } from '../godotAlphaCut';
import { AlphaCutMode } from '../../nodes/3d/sprite3d/types';
import {
  cutSurfaceAlpha,
  instanceSurfaceAlpha,
  withInstanceTransparency,
  type AlphaPassSurface,
} from './instanceTransparency';
import { ALBEDO_ALPHA_UNREAD } from './surfaceAlphaPatch';

const OPAQUE_SURFACE: AlphaPassSurface = {
  opacity: 1,
  transparent: false,
  depthWrite: true,
  alphaPassDepthWrite: false,
};

/** A Sprite3D discard cut at 0.5, with or without FLAG_TRANSPARENT. */
function discardCut(transparentFlag: boolean) {
  return alphaCutSurface({ mode: AlphaCutMode.ALPHA_CUT_DISCARD, scissorThreshold: 0.5, transparentFlag });
}

describe('instanceSurfaceAlpha', () => {
  it('leaves the surface as it is for an opaque instance', () => {
    expect(instanceSurfaceAlpha(OPAQUE_SURFACE, 0)).toEqual({
      opacity: 1,
      transparent: false,
      depthWrite: true,
    });
  });

  it('multiplies the instance alpha into the surface opacity', () => {
    const surface = { ...OPAQUE_SURFACE, opacity: 0.5, transparent: true };
    expect(instanceSurfaceAlpha(surface, 0.3).opacity).toBe((0.5 * 178) / 255);
  });

  it('moves an opaque surface to the blended pass', () => {
    expect(instanceSurfaceAlpha(OPAQUE_SURFACE, 0.3).transparent).toBe(true);
  });

  it('writes depth as the surface does in the alpha pass', () => {
    const surface = { ...OPAQUE_SURFACE, alphaPassDepthWrite: true };
    expect(instanceSurfaceAlpha(OPAQUE_SURFACE, 0.3).depthWrite).toBe(false);
    expect(instanceSurfaceAlpha(surface, 0.3).depthWrite).toBe(true);
  });
});

describe('cutSurfaceAlpha', () => {
  it('adds nothing to a cut surface in the opaque pass', () => {
    expect(cutSurfaceAlpha(discardCut(true), 1, 0)).not.toHaveProperty('blending');
  });

  it('writes alpha 1 past the cut once the instance blends it, as Godot does', () => {
    expect(cutSurfaceAlpha(discardCut(true), 1, 0.5).blending).toBe(THREE.NoBlending);
  });

  it('drops the texture alpha of a sprite without FLAG_TRANSPARENT once the instance blends it', () => {
    expect(cutSurfaceAlpha(discardCut(false), 1, 0.5).injection).toBe(ALBEDO_ALPHA_UNREAD);
  });
});

describe('withInstanceTransparency', () => {
  it('returns the same bag for an opaque instance', () => {
    const bag = standardMaterialBag(parseStandardMaterial3DScalars({}));
    expect(withInstanceTransparency(bag, null, 0)).toBe(bag);
  });

  it("blends Godot's default surface without a depth write", () => {
    const { props } = withInstanceTransparency(standardMaterialBag(null), null, 0.5);
    expect(props).toMatchObject({ transparent: true, depthWrite: false, opacity: 127 / 255 });
  });

  it('drops the texture alpha of an opaque material once the instance blends it', () => {
    const scalars = parseStandardMaterial3DScalars({});
    const bag = withInstanceTransparency(standardMaterialBag(scalars), scalars, 0.5);
    expect(bagAlphaProps(bag)).toEqual({ injection: ALBEDO_ALPHA_UNREAD });
  });

  it('overwrites past the scissor cut once the instance blends it', () => {
    const scalars = parseStandardMaterial3DScalars({ transparency: '2' });
    const bag = withInstanceTransparency(standardMaterialBag(scalars), scalars, 0.5);
    expect(bagAlphaProps(bag)).toEqual({ blending: THREE.NoBlending });
  });

  it("adds nothing to Godot's default surface", () => {
    expect(bagAlphaProps(withInstanceTransparency(standardMaterialBag(null), null, 0.5))).toEqual({});
  });

  it("reads the material's own alpha-pass depth write", () => {
    const scalars = parseStandardMaterial3DScalars({ depth_draw_mode: '1' });
    const { props } = withInstanceTransparency(standardMaterialBag(scalars), scalars, 0.5);
    expect(props.depthWrite).toBe(true);
  });
});
