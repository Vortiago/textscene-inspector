import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GODOT_NORMAL_MAP_READ, importedNormalMapRead } from './godotNormalMap';
import { installedShaderChunks } from '../testing/shaderPatches';
import { functionBody, preprocessorBranch } from '../testing/glslSource';

const normalMapped = () => new THREE.MeshStandardMaterial({ normalMap: new THREE.Texture() });

describe('importedNormalMapRead', () => {
  it("is Godot's read for a material with a normal map", () => {
    expect(importedNormalMapRead(normalMapped())).toBe(GODOT_NORMAL_MAP_READ);
  });

  it('is none for a material without one', () => {
    expect(importedNormalMapRead(new THREE.MeshStandardMaterial())).toBeUndefined();
  });

  it('is none for a material that has no normal map slot (edge case)', () => {
    expect(importedNormalMapRead(new THREE.MeshBasicMaterial())).toBeUndefined();
  });
});

describe('the installed normal map read', () => {
  it('decodes a tangent-space texel in one function that takes its own gradients', () => {
    const decode = functionBody(installedShaderChunks().normalmap_pars_fragment, 'godotMapNormal');
    expect(decode).toContain('textureGrad( normalMap, uv, uvDx, uvDy )');
    expect(decode).toContain('mapN.xy *= normalScale;');
    expect(decode).toContain('return normalize( tbn * mapN );');
  });

  it("reads the pixel's own texel through that function", () => {
    const tangentRead = preprocessorBranch(
      installedShaderChunks().normal_fragment_maps,
      '#elif defined( USE_NORMALMAP_TANGENTSPACE )'
    );
    expect(tangentRead).toContain(
      'normal = godotMapNormal( vNormalMapUv, dFdx( vNormalMapUv ), dFdy( vNormalMapUv ), tbn );'
    );
    expect(tangentRead).not.toContain('texture2D');
  });

  it('declares the tangent frame the roughness limiter reads, before the setup chunk (edge case)', () => {
    expect(THREE.ShaderChunk.normal_fragment_begin).toContain('mat3 tbn = ');
  });
});
