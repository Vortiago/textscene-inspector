/**
 * The LightmapGIData decode, from a bake Godot wrote and from the `.tres` text Godot writes for a
 * LightmapGIData. Each default and refusal cites `scene/3d/lightmap_gi.h` or `lightmap_gi.cpp`.
 */

import { describe, expect, it } from 'vitest';
import { parseTresFile } from '../../parser/parsedResource';
import { parseBinaryResource } from '../formats/binaryresource/parse';
import { ragdollBytes } from '../testing/ragdollBake';
import { decodeLightmapGIData } from './decode';

/** A `.tres` LightmapGIData whose `[resource]` body is `body`. */
function decodeText(body: string) {
  return decodeLightmapGIData(
    parseTresFile(
      '[gd_resource type="LightmapGIData" format=3]\n\n' +
        '[ext_resource type="CompressedTexture2DArray" path="res://bake.exr" id="1_tex"]\n\n' +
        `[resource]\n${body}\n`
    )
  );
}

describe('decodeLightmapGIData on the ragdoll bake', () => {
  const bake = () => decodeLightmapGIData(parseBinaryResource(ragdollBytes('ragdoll_physics.lmbake')));

  it('reads each baked user: its node path, its rect in the atlas, its slice and its sub-instance', () => {
    const [user] = bake().users;
    expect(user).toEqual({
      path: '../StaticBody3D/CSGBakedMeshInstance3D',
      uvScale: { x: 0.00024414063, y: 0.00024414063, width: 0.7597656, height: 0.5371094 },
      sliceIndex: 0,
      subInstance: -1,
    });
  });

  it('resolves each lightmap texture to the path its external resource names', () => {
    expect(bake().lightmapTextures).toEqual(['res://ragdoll_physics.exr']);
  });

  it('reads the exposure the bake ran at from its probe data', () => {
    expect(bake().bakedExposure).toBe(1);
  });
});

describe('decodeLightmapGIData on text', () => {
  it('reads the typed array Godot writes for the lightmap textures', () => {
    expect(
      decodeText('lightmap_textures = Array[TextureLayered]([ExtResource("1_tex")])').lightmapTextures
    ).toEqual(['res://bake.exr']);
  });

  it('gives each user its own slice', () => {
    const { users } = decodeText(
      'user_data = [NodePath("../A"), Rect2(0, 0, 0.5, 0.5), 0, -1, NodePath("../B"), Rect2(0, 0, 0.25, 0.5), 1, -1]'
    );
    expect(users.map(({ path, sliceIndex }) => [path, sliceIndex])).toEqual([
      ['../A', 0],
      ['../B', 1],
    ]);
  });

  it('keeps no user when the array is not whole groups of four, as `_set_user_data` refuses it', () => {
    expect(decodeText('user_data = [NodePath("../A"), Rect2(0, 0, 1, 1), 0]').users).toEqual([]);
  });

  it('reads spherical harmonics as off when the file leaves it out, the default in lightmap_gi.h:63', () => {
    expect(decodeText('').usesSphericalHarmonics).toBe(false);
  });

  it('reads spherical harmonics as on when the file sets it', () => {
    expect(decodeText('uses_spherical_harmonics = true').usesSphericalHarmonics).toBe(true);
  });

  it('reads a baked exposure of 1 when the file has no probe data, the default in lightmap_gi.h:70', () => {
    expect(decodeText('').bakedExposure).toBe(1);
  });

  it('reads the baked exposure the probe data holds', () => {
    expect(decodeText('probe_data = {\n"baked_exposure": 2.5,\n"interior": false\n}').bakedExposure).toBe(
      2.5
    );
  });
});
