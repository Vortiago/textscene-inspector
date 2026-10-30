import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GODOT_NORMAL_MAP_READ, importedNormalMapRead } from './godotNormalMap';
import { installedShaderChunks } from '../testing/shaderPatches';
import { functionBody, preprocessorBranch } from '../testing/glslSource';
import { UNIT_TANGENT_FRAME } from '../testing/patchedFragment';

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
  it("reads a texel a step along the screen at the pixel's own gradients", () => {
    expect(installedShaderChunks().normalmap_pars_fragment).toContain(
      '#define GODOT_NORMAL_TEXEL( step ) textureGrad( normalMap, vNormalMapUv + ( step ).x * godotUvDx + ( step ).y * godotUvDy, godotUvDx, godotUvDy )'
    );
  });

  it('decodes a tangent-space texel in one function', () => {
    const decode = functionBody(installedShaderChunks().normalmap_pars_fragment, 'godotMapNormal');
    expect(decode).toContain('vec3 mapN = texel.xyz * 2.0 - 1.0;');
    expect(decode).toContain('mapN.xy *= normalScale;');
    expect(decode).toContain('return normalize( tbn * mapN );');
  });

  it("reads the pixel's own texel through that function", () => {
    const tangentRead = preprocessorBranch(
      installedShaderChunks().normal_fragment_maps,
      '#elif defined( USE_NORMALMAP_TANGENTSPACE )'
    );
    expect(tangentRead).toContain('normal = godotMapNormal( GODOT_NORMAL_TEXEL( vec2( 0.0 ) ), tbn );');
    expect(tangentRead).not.toContain('texture2D');
  });

  it('declares the map UV gradients once, for the pixel and the limiter', () => {
    const begin = installedShaderChunks().normal_fragment_begin;
    expect(begin).toContain('vec2 godotUvDx = dFdx( vNormalMapUv );');
    expect(begin).toContain('vec2 godotUvDy = dFdy( vNormalMapUv );');
  });

  it('scales the tangent and the binormal of the derivative frame to unit length each', () => {
    const frame = functionBody(installedShaderChunks().normalmap_pars_fragment, 'getTangentFrame');
    expect(frame).toContain(UNIT_TANGENT_FRAME);
    expect(frame).not.toContain('inversesqrt( det )');
  });

  it('declares the tangent frame the roughness limiter reads, before the setup chunk (edge case)', () => {
    expect(THREE.ShaderChunk.normal_fragment_begin).toContain('mat3 tbn = ');
  });
});
