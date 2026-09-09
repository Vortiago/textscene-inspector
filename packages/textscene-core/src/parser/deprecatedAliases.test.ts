/**
 * A deprecated `_set` arm as seen through the whole scan: the property bag
 * carries the key the setter writes and the literal it receives, and the
 * typed parsers read both under the modern name.
 */

import { describe, expect, it } from 'vitest';
import { TscnParser } from './TscnParser';
import { parseTresFile } from './parsedResource';
import { decodeBoxShape3D } from '../resources/shapes/boxshape3d/decode';
import { decodeRectangleShape2D } from '../resources/shapes/rectangleshape2d/decode';

const parse = (body: string) => new TscnParser().parse(`[gd_scene format=3]\n\n${body}\n`);

describe('extents → size * 2 through the scan', () => {
  it('BoxShape3D extents = Vector3(3, 1, 3) decodes as size (6, 2, 6)', () => {
    // box_shape_3d.cpp:81-83; measured on 4.6.3.
    const scene = parse('[sub_resource type="BoxShape3D" id="1"]\nextents = Vector3(3, 1, 3)\n\n[node name="R" type="Node"]');
    const data = scene.internalResources[0]!.data as Record<string, string>;
    expect(data.size).toBe('Vector3(6, 2, 6)');
    expect(data.extents).toBeUndefined();
    expect(decodeBoxShape3D(data).size).toEqual({ x: 6, y: 2, z: 6 });
  });

  it('RectangleShape2D extents = Vector2(16, 8) decodes as size (32, 16)', () => {
    // rectangle_shape_2d.cpp:42-44; measured on 4.6.3.
    const scene = parse('[sub_resource type="RectangleShape2D" id="1"]\nextents = Vector2(16, 8)\n\n[node name="R" type="Node"]');
    const data = scene.internalResources[0]!.data as Record<string, string>;
    expect(decodeRectangleShape2D(data).size).toEqual({ x: 32, y: 16 });
  });

  it('resolves against the header type in a standalone .tres [resource] body', () => {
    // A shape saved as its own file names its class once, in `[gd_resource
    // type=]`; the `[resource]` body carries no type of its own.
    const tres = parseTresFile(
      '[gd_resource type="BoxShape3D" format=3]\n\n[resource]\nextents = Vector3(3, 1, 3)\n'
    );
    expect(tres.properties).toEqual({ size: 'Vector3(6, 2, 6)' });
    expect(decodeBoxShape3D(tres.properties).size).toEqual({ x: 6, y: 2, z: 6 });
  });

  it('Decal extents = Vector3(1, 2, 3) parses as size (2, 4, 6)', () => {
    // decal.cpp:274-276; measured on 4.6.3.
    const scene = parse('[node name="D" type="Decal"]\nextents = Vector3(1, 2, 3)');
    expect((scene.nodes[0]!.properties as { size: unknown }).size).toEqual({ x: 2, y: 4, z: 6 });
  });
});

describe('bool-gated enum arms through the scan', () => {
  it('TextureRect expand = true parses as expandMode 1, expand = false leaves it unset', () => {
    // texture_rect.cpp:171-173; measured on 4.6.3.
    const on = parse('[node name="T" type="TextureRect"]\nexpand = true');
    expect((on.nodes[0]!.properties as { expandMode?: number }).expandMode).toBe(1);
    expect(on.nodes[0]!.rawProperties).toEqual({ expand_mode: '1' });
    const off = parse('[node name="T" type="TextureRect"]\nexpand = false');
    expect((off.nodes[0]!.properties as { expandMode?: number }).expandMode).toBeUndefined();
    expect(off.nodes[0]!.rawProperties).toEqual({ expand: 'false' });
  });

  it('MeshInstance3D use_in_baked_light = true parses as giMode 1 through the base-class arm', () => {
    // visual_instance_3d.cpp:323-325; measured on 4.6.3.
    const scene = parse('[node name="M" type="MeshInstance3D"]\ngi_mode = 0\nuse_in_baked_light = true');
    expect((scene.nodes[0]!.properties as { giMode?: number }).giMode).toBe(1);
    const dynamic = parse('[node name="M" type="MeshInstance3D"]\nuse_dynamic_gi = true');
    expect((dynamic.nodes[0]!.properties as { giMode?: number }).giMode).toBe(2);
  });
});

describe('pure renames through the scan', () => {
  it('TileMap cell_quadrant_size lands in the rendering_quadrant_size slot', () => {
    // tile_map.cpp:695-697.
    const scene = parse('[node name="T" type="TileMap"]\ncell_quadrant_size = 32');
    expect(scene.nodes[0]!.rawProperties).toEqual({ rendering_quadrant_size: '32' });
  });

  it('TileSetAtlasSource x:y/alt/texture_offset lands under texture_origin', () => {
    // tile_set.cpp:4812 → :6702-6704.
    const scene = parse(
      '[sub_resource type="TileSetAtlasSource" id="1"]\n0:0/0 = 0\n0:0/0/texture_offset = Vector2i(3, 4)\n\n[node name="R" type="Node"]'
    );
    expect(scene.internalResources[0]!.data['0:0/0/texture_origin']).toBe('Vector2i(3, 4)');
    expect(scene.internalResources[0]!.data['0:0/0/texture_offset']).toBeUndefined();
  });
});
