/**
 * parseTresFile — full-file .tres parsing: the [gd_resource] header type, the
 * [ext_resource]/[sub_resource] sections, and the [resource] body, all as raw
 * value strings.
 */
import { describe, it, expect } from 'vitest';
import { parseTresFile } from './parsedResource';

const TILESET_TRES = `[gd_resource type="TileSet" load_steps=3 format=3 uid="uid://x"]

[ext_resource type="Texture2D" uid="uid://y" path="res://tileset/isotiles.png" id="1"]

[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_s3w07"]
texture = ExtResource("1")
margins = Vector2i(28, 75)
texture_region_size = Vector2i(135, 105)
0:0/0 = 0
0:0/1 = 1
0:0/1/flip_h = true

[resource]
tile_shape = 1
tile_layout = 5
tile_size = Vector2i(128, 64)
sources/0 = SubResource("TileSetAtlasSource_s3w07")
`;

describe('parseTresFile', () => {
  it('captures the resource type, ext/sub resources, and [resource] properties as raw strings', () => {
    const parsed = parseTresFile(TILESET_TRES);

    expect(parsed.resourceType).toBe('TileSet');
    expect(parsed.extResources).toEqual([
      { id: '1', type: 'Texture2D', path: 'res://tileset/isotiles.png' },
    ]);
    expect(parsed.subResources).toHaveLength(1);
    expect(parsed.subResources[0]!.type).toBe('TileSetAtlasSource');
    expect(parsed.subResources[0]!.data['0:0/1/flip_h']).toBe('true');
    expect(parsed.properties).toMatchObject({
      tile_shape: '1',
      tile_layout: '5',
      tile_size: 'Vector2i(128, 64)',
      'sources/0': 'SubResource("TileSetAtlasSource_s3w07")',
    });
  });

  it('throws on a file without a [gd_resource] header', () => {
    expect(() => parseTresFile('[gd_scene format=3]\n')).toThrow(/gd_resource/);
  });
});
