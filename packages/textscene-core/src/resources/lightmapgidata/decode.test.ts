/**
 * The LightmapGIData decode, from a bake Godot wrote and from the `.tres` text Godot writes for a
 * LightmapGIData. Each default and refusal cites `scene/3d/lightmap_gi.h` or `lightmap_gi.cpp`.
 */

import { describe, expect, it } from 'vitest';
import { parseTresFile } from '../../parser/parsedResource';
import { parseBinaryResource } from '../formats/binaryresource/parse';
import { ragdollBytes } from '../testing/ragdollBake';
import { EMPTY_AABB } from '../../godot/math/aabb';
import { decodeLightmapGIData } from './decode';

/** A `.tres` LightmapGIData whose `[resource]` body is `body`. */
function decodeText(body: string) {
  const { properties, extResources } = parseTresFile(
    '[gd_resource type="LightmapGIData" format=3]\n\n' +
      '[ext_resource type="CompressedTexture2DArray" path="res://bake.exr" id="1_tex"]\n\n' +
      `[resource]\n${body}\n`
  );
  return decodeLightmapGIData(properties, extResources);
}

/** A `probe_data` Dictionary with bounds of size 2 and `points`. */
function probeData(points: string): string {
  return (
    'probe_data = {\n"bounds": AABB(-1, -1, -1, 2, 2, 2), "points": ' +
    points +
    ', "tetrahedra": PackedInt32Array(), "bsp": PackedInt32Array(), "sh": PackedColorArray(), ' +
    '"interior": false, "baked_exposure": 1.0\n}'
  );
}

/** One user's `user_data`, as Godot writes it. */
const ONE_USER = 'user_data = [NodePath("../Mesh"), Rect2(0, 0, 1, 1), 0, -1]';

describe('decodeLightmapGIData on the ragdoll bake', () => {
  const bake = async () => {
    const { properties, extResources } = await parseBinaryResource(ragdollBytes('ragdoll_physics.lmbake'));
    return decodeLightmapGIData(properties, extResources);
  };

  it('reads each baked user: its node path, its rect in the atlas, its slice and its sub-instance', async () => {
    const [user] = (await bake()).users;
    expect(user).toEqual({
      path: '../StaticBody3D/CSGBakedMeshInstance3D',
      uvScale: { x: 0.00024414063, y: 0.00024414063, width: 0.7597656, height: 0.5371094 },
      sliceIndex: 0,
      subInstance: -1,
    });
  });

  it('resolves each lightmap texture to the path its external resource names', async () => {
    expect((await bake()).lightmapTextures).toEqual(['res://ragdoll_physics.exr']);
  });

  it('reads the capture bounds the renderer culls the lightmap by', async () => {
    expect((await bake()).bounds).toEqual({
      position: { x: -8.023788, y: -0.6158713, z: -8.023788 },
      size: { x: 16.047577, y: 8.023788, z: 16.047577 },
    });
  });
});

describe('decodeLightmapGIData on text', () => {
  it('reads the typed array Godot writes for the lightmap textures', () => {
    expect(
      decodeText('lightmap_textures = Array[TextureLayered]([ExtResource("1_tex")])').lightmapTextures
    ).toEqual(['res://bake.exr']);
  });

  it('reads the lightmap textures an older bake spells `light_textures`, which the setter hands on', () => {
    expect(decodeText('light_textures = [ExtResource("1_tex")]').lightmapTextures).toEqual([
      'res://bake.exr',
    ]);
  });

  it('simplifies a texture path as Godot simplifies every resource path', () => {
    const { properties, extResources } = parseTresFile(
      '[gd_resource type="LightmapGIData" format=3]\n\n' +
        '[ext_resource type="CompressedTexture2DArray" path="res:///bakes//bake.exr" id="1_tex"]\n\n' +
        '[resource]\nlightmap_textures = [ExtResource("1_tex")]\n'
    );
    expect(decodeLightmapGIData(properties, extResources).lightmapTextures).toEqual(['res://bakes/bake.exr']);
  });

  it('reads a BOOL slice as the int the Variant converts it to (edge case)', () => {
    const { users } = decodeText('user_data = [NodePath("../A"), Rect2(0, 0, 1, 1), true, -1]');
    expect(users.map(({ sliceIndex }) => sliceIndex)).toEqual([1]);
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

  it('reads no capture bounds from data with no probe data, as LightmapGIData starts with none', () => {
    expect(decodeText('').bounds).toEqual(EMPTY_AABB);
  });

  it('reads the capture bounds from points in the Array spelling the PackedVector3Array slot converts', () => {
    expect(decodeText(probeData('[Vector3(0, 0, 0)]')).bounds.size).toEqual({ x: 2, y: 2, z: 2 });
  });

  it('reads no capture bounds from probe data with no points, which set_capture_data drops', () => {
    expect(decodeText(probeData('PackedVector3Array()')).bounds).toEqual(EMPTY_AABB);
  });

  it('reads no capture bounds from probe data missing a field, which _set_probe_data refuses (error case)', () => {
    expect(
      decodeText(probeData('PackedVector3Array(0, 0, 0)').replace('"bsp": PackedInt32Array(), ', '')).bounds
    ).toEqual(EMPTY_AABB);
  });

  it('keeps the users of directional data in the packed format a 4.x bake writes', () => {
    const body = 'uses_spherical_harmonics = true\n_uses_packed_directional = true\n' + ONE_USER;
    expect(decodeText(body).users).toHaveLength(1);
  });

  it('assigns no user from directional data in the old unpacked format, which LightmapGI refuses', () => {
    expect(decodeText('uses_spherical_harmonics = true\n' + ONE_USER).users).toEqual([]);
  });
});
