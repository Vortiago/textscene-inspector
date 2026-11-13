/** Which surfaces draw through the shader module's lit material, on a page with the nodes form. */

import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { RootState } from '@react-three/fiber';
import { DiffuseMode } from '../../godot/rendering/materials/diffuseMode';
import { SpecularMode } from '../../godot/rendering/materials/specularMode';
import { standardMaterialBags } from '../../resources/materials/standardmaterial3d/materialBag';
import { parseStandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/scalars.testkit';
import type { ResolvedTextures } from '../../resources/materials/standardmaterial3d/types';

function bag(properties: Record<string, string> | null, textures?: ResolvedTextures) {
  return standardMaterialBags(properties && parseStandardMaterial3DScalars(properties), textures).unfaded;
}

/** `litSurfaceMaterial` as a fresh load on a page at `url` reads it, with a prepared canvas or none. */
async function litSurfaceMaterialAt(url: string, prepared = true) {
  window.history.replaceState(null, '', url);
  vi.resetModules();
  if (prepared) {
    const { prepareCanvasRenderer } = await import('./prepareCanvasRenderer');
    prepareCanvasRenderer({ gl: { setNodesHandler: vi.fn() } } as unknown as RootState);
  }
  return (await import('./litSurfaceMaterial')).litSurfaceMaterial;
}

const NODES_PAGE = '/?litSurface=nodes';

describe('litSurfaceMaterial', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('answers nothing on a page that draws the patched form', async () => {
    const litSurfaceMaterial = await litSurfaceMaterialAt('/');

    expect(litSurfaceMaterial(bag({}))).toBeNull();
  });

  it('answers nothing before a canvas has prepared its renderer', async () => {
    const litSurfaceMaterial = await litSurfaceMaterialAt(NODES_PAGE, false);

    expect(litSurfaceMaterial(bag({}))).toBeNull();
  });

  it('describes a plain surface, in its light modes', async () => {
    const litSurfaceMaterial = await litSurfaceMaterialAt(NODES_PAGE);
    const lit = litSurfaceMaterial(bag({ diffuse_mode: '3', specular_mode: '1' }));

    expect(lit?.program).toEqual({
      diffuseMode: DiffuseMode.DIFFUSE_TOON,
      specularMode: SpecularMode.SPECULAR_TOON,
      hasClearcoat: false,
    });
  });

  it('describes the surface with no material in Godot’s default light modes', async () => {
    const litSurfaceMaterial = await litSurfaceMaterialAt(NODES_PAGE);

    expect(litSurfaceMaterial(bag(null))?.program.diffuseMode).toBe(DiffuseMode.DIFFUSE_LAMBERT);
  });

  it('carries Godot’s specular and the clearcoat of a physical surface', async () => {
    const litSurfaceMaterial = await litSurfaceMaterialAt(NODES_PAGE);
    const lit = litSurfaceMaterial(
      bag({
        metallic_specular: '0.25',
        clearcoat_enabled: 'true',
        clearcoat: '0.5',
        clearcoat_roughness: '0.2',
      })
    );

    expect(lit?.program.hasClearcoat).toBe(true);
    expect(lit?.fields.specular).toBeCloseTo(0.25, 12);
    expect(lit?.fields.clearcoat).toBe(0.5);
  });

  it('makes a material with the bag’s fields', async () => {
    const litSurfaceMaterial = await litSurfaceMaterialAt(NODES_PAGE);
    const material = litSurfaceMaterial(bag({ roughness: '0.3', metallic: '0.7' }))!.create();

    expect([material.roughness, material.metalness]).toEqual([0.3, 0.7]);
  });

  it.each([
    ['a texture', bag({}, { albedo_texture: new THREE.Texture() })],
    ['a blend', bag({ transparency: '1' })],
    ['a rim', bag({ rim_enabled: 'true', rim: '1' })],
    ['an anisotropy', bag({ anisotropy_enabled: 'true', anisotropy: '0.5' })],
    ['a patch beside the light modes', bag({ disable_specular_occlusion: 'true' })],
    ['an unshaded mode', bag({ shading_mode: '0' })],
  ])('keeps the classic material for a surface with %s', async (_feature, surface) => {
    const litSurfaceMaterial = await litSurfaceMaterialAt(NODES_PAGE);

    expect(litSurfaceMaterial(surface)).toBeNull();
  });
});
