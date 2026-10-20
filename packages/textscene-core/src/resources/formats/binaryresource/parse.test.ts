/**
 * The binary resource reader, against the `.lmbake` Godot 4.5 baked for the ragdoll demo. Each
 * expected value is the text Godot 4.6.3 writes for the same property when it saves the loaded
 * resource as a `.tres` (`ResourceSaver.save`).
 */

import { describe, expect, it } from 'vitest';
import { parseBinaryResource } from './parse';
import { ragdollBytes } from '../../testing/ragdollBake';
import { binaryResourceBytes, ByteWriter, type BinaryResourceLayout } from './testing/binaryResourceBytes';

describe('parseBinaryResource on a Godot bake', () => {
  const bake = () => parseBinaryResource(ragdollBytes('ragdoll_physics.lmbake'));

  it('reads the class of the main resource from the header', () => {
    expect(bake().resourceType).toBe('LightmapGIData');
  });

  it('lists each external resource by its path and type, numbered from 1', () => {
    expect(bake().extResources).toEqual([
      { id: '1', path: 'res://ragdoll_physics.exr', type: 'CompressedTexture2DArray' },
    ]);
  });

  it('writes an external resource property as an ExtResource reference', () => {
    expect(bake().properties.lightmap_textures).toBe('[ExtResource("1")]');
  });

  it('writes an array of a node path, a rect and two integers', () => {
    expect(bake().properties.user_data).toBe(
      '[NodePath("../StaticBody3D/CSGBakedMeshInstance3D"), ' +
        'Rect2(0.00024414063, 0.00024414063, 0.7597656, 0.5371094), 0, -1]'
    );
  });

  it('writes a dictionary keyed by strings', () => {
    expect(bake().properties.probe_data).toContain('"baked_exposure": 1.0');
  });

  it('writes a null object as null', () => {
    expect(bake().properties.script).toBe('null');
  });

  it('keeps no sub-resource, as the bake holds only its main resource', () => {
    expect(bake().subResources).toEqual([]);
  });
});

describe('parseBinaryResource on other bytes', () => {
  it('refuses a file without the RSRC magic, naming what it found', () => {
    const text = new TextEncoder().encode('[gd_resource type="LightmapGIData"]').buffer;
    expect(() => parseBinaryResource(text)).toThrow(
      'expected a binary resource starting with RSRC, got "[gd_"'
    );
  });
});

describe('parseBinaryResource on each header and table form', () => {
  /** A Vector3 variant (tag 12) in the file's byte order and `real_t` width. */
  const vector3 = (isBigEndian: boolean, isRealDouble: boolean) => {
    const writer = new ByteWriter(isBigEndian).u32(12);
    for (const component of [1.5, -2, 0.25]) {
      if (isRealDouble) writer.f64(component);
      else writer.f32(component);
    }
    return writer.bytes();
  };

  const withPosition = (variant: Uint8Array, options: Partial<BinaryResourceLayout> = {}) =>
    binaryResourceBytes({
      strings: ['position'],
      resources: [{ id: 'Main', type: 'Resource', properties: [{ name: 'position', variant }] }],
      ...options,
    });

  it('reads a real_t the header stores as a double', () => {
    const file = withPosition(vector3(false, true), { isRealDouble: true });
    expect(parseBinaryResource(file).properties.position).toBe('Vector3(1.5, -2, 0.25)');
  });

  it('reads a file the header marks big endian', () => {
    const file = withPosition(vector3(true, false), { isBigEndian: true });
    expect(parseBinaryResource(file).properties.position).toBe('Vector3(1.5, -2, 0.25)');
  });

  it('skips the script class a header names', () => {
    const file = withPosition(vector3(false, false), { scriptClass: 'BakedThing' });
    expect(parseBinaryResource(file).properties.position).toBe('Vector3(1.5, -2, 0.25)');
  });

  it('writes an absolute node path with its subnames', () => {
    const variant = new ByteWriter()
      .u32(22)
      .u16(2)
      .u16(0x8000 | 1)
      .u32(1)
      .u32(2)
      .u32(3)
      .bytes();
    const file = binaryResourceBytes({
      strings: ['target', 'root', 'Mesh', 'scale'],
      resources: [{ id: 'Main', type: 'Resource', properties: [{ name: 'target', variant }] }],
    });
    expect(parseBinaryResource(file).properties.target).toBe('NodePath("/root/Mesh:scale")');
  });

  it('reads a name the file writes inline rather than in its string table', () => {
    const inlineName = new TextEncoder().encode('Mesh');
    const variant = new ByteWriter()
      .u32(22)
      .u16(1)
      .u16(0)
      .u32(0x80000000 | inlineName.length)
      .raw(inlineName);
    const file = binaryResourceBytes({
      strings: ['target'],
      resources: [
        { id: 'Main', type: 'Resource', properties: [{ name: 'target', variant: variant.bytes() }] },
      ],
    });
    expect(parseBinaryResource(file).properties.target).toBe('NodePath("Mesh")');
  });

  it('keeps each internal resource before the main one as a sub-resource under its local id', () => {
    const file = binaryResourceBytes({
      strings: ['size', 'mesh'],
      resources: [
        { id: 'BoxMesh_x1', type: 'BoxMesh', properties: [{ name: 'size', variant: vector3(false, false) }] },
        {
          id: 'Main',
          type: 'Resource',
          properties: [{ name: 'mesh', variant: new ByteWriter().u32(24).u32(2).u32(0).bytes() }],
        },
      ],
    });
    const parsed = parseBinaryResource(file);
    expect(parsed.properties.mesh).toBe('SubResource("BoxMesh_x1")');
    expect(parsed.subResources).toEqual([
      { id: 'BoxMesh_x1', type: 'BoxMesh', data: { size: 'Vector3(1.5, -2, 0.25)' } },
    ]);
  });

  it('refuses a compressed resource, which only Godot can inflate', () => {
    const file = new TextEncoder().encode('RSCC').buffer;
    expect(() => parseBinaryResource(file)).toThrow('expected an uncompressed binary resource, got RSCC');
  });

  it('refuses a truncated file, naming the offset it stopped at', () => {
    const file = withPosition(vector3(false, false)).slice(0, 40);
    expect(() => parseBinaryResource(file)).toThrow(/expected \d+ more bytes at offset \d+/);
  });
});
