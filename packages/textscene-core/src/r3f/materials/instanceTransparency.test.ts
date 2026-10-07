import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { standardMaterialBag } from '../../resources/materials/standardmaterial3d/materialBag';
import { parseStandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/scalars';
import {
  instanceSurfaceAlpha,
  withInstanceTransparency,
  type AlphaPassSurface,
} from './instanceTransparency';

const OPAQUE_SURFACE: AlphaPassSurface = {
  opacity: 1,
  transparent: false,
  depthWrite: true,
  blending: THREE.NormalBlending,
  alphaPassDepthWrite: false,
  opaqueAfterCut: false,
};

describe('instanceSurfaceAlpha', () => {
  it('leaves the surface as it is for an opaque instance', () => {
    expect(instanceSurfaceAlpha(OPAQUE_SURFACE, 0)).toEqual({
      opacity: 1,
      transparent: false,
      depthWrite: true,
      blending: THREE.NormalBlending,
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

  it('writes a cut surface unblended, since Godot sets alpha 1 for the fragments it keeps', () => {
    const surface = { ...OPAQUE_SURFACE, opaqueAfterCut: true };
    expect(instanceSurfaceAlpha(surface, 0.3).blending).toBe(THREE.NoBlending);
  });

  it('keeps a blend mode other than MIX on a cut surface', () => {
    const surface = { ...OPAQUE_SURFACE, opaqueAfterCut: true, blending: THREE.AdditiveBlending };
    expect(instanceSurfaceAlpha(surface, 0.3).blending).toBe(THREE.AdditiveBlending);
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

  it("reads the material's own alpha-pass depth write", () => {
    const scalars = parseStandardMaterial3DScalars({ depth_draw_mode: '1' });
    const { props } = withInstanceTransparency(standardMaterialBag(scalars), scalars, 0.5);
    expect(props.depthWrite).toBe(true);
  });
});
