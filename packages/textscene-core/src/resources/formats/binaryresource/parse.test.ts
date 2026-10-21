/**
 * The binary resource reader, against the `.lmbake` Godot 4.5 baked for the ragdoll demo. Each
 * expected value is the text Godot 4.6.3 writes for the same property when it saves the loaded
 * resource as a `.tres` (`ResourceSaver.save`).
 */

import { describe, expect, it } from 'vitest';
import { parseBinaryResource } from './parse';
import { ragdollBytes } from '../../testing/ragdollBake';
import { binaryResourceBytes, ByteWriter, type BinaryResourceLayout } from './testing/binaryResourceBytes';
import {
  ABSOLUTE_NODE_PATH,
  INLINE_STRING,
  ObjectRef,
  VariantTag,
} from '../../../godot/project/binaryResourceFormat';

describe('parseBinaryResource on a Godot bake', () => {
  const bake = () => parseBinaryResource(ragdollBytes('ragdoll_physics.lmbake'));

  it('reads the class of the main resource from the header', async () => {
    expect((await bake()).resourceType).toBe('LightmapGIData');
  });

  it('lists each external resource by its path and type, numbered from 1', async () => {
    expect((await bake()).extResources).toEqual([
      { id: '1', path: 'res://ragdoll_physics.exr', type: 'CompressedTexture2DArray' },
    ]);
  });

  it('writes an external resource property as an ExtResource reference', async () => {
    expect((await bake()).properties.lightmap_textures).toBe('[ExtResource("1")]');
  });

  it('writes an array of a node path, a rect and two integers', async () => {
    expect((await bake()).properties.user_data).toBe(
      '[NodePath("../StaticBody3D/CSGBakedMeshInstance3D"), ' +
        'Rect2(0.00024414063, 0.00024414063, 0.7597656, 0.5371094), 0, -1]'
    );
  });

  it('writes a dictionary keyed by strings', async () => {
    expect((await bake()).properties.probe_data).toContain('"baked_exposure": 1.0');
  });

  it('writes a null object as null', async () => {
    expect((await bake()).properties.script).toBe('null');
  });

  it('keeps no sub-resource, as the bake holds only its main resource', async () => {
    expect((await bake()).subResources).toEqual([]);
  });
});

describe('parseBinaryResource on other bytes', () => {
  it('refuses a file without the RSRC magic, naming what it found', async () => {
    const text = new TextEncoder().encode('[gd_resource type="LightmapGIData"]').buffer;
    await expect(parseBinaryResource(text)).rejects.toThrow(
      'expected a binary resource starting with RSRC, got "[gd_"'
    );
  });
});

describe('parseBinaryResource on each header and table form', () => {
  /** A Vector3 variant in the file's byte order and `real_t` width. */
  const vector3 = (isBigEndian: boolean, isRealDouble: boolean) => {
    const writer = new ByteWriter(isBigEndian).u32(VariantTag.Vector3);
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

  it('reads a real_t the header stores as a double', async () => {
    const file = withPosition(vector3(false, true), { isRealDouble: true });
    expect((await parseBinaryResource(file)).properties.position).toBe('Vector3(1.5, -2, 0.25)');
  });

  it('reads a file the header marks big endian', async () => {
    const file = withPosition(vector3(true, false), { isBigEndian: true });
    expect((await parseBinaryResource(file)).properties.position).toBe('Vector3(1.5, -2, 0.25)');
  });

  it('skips the script class a header names', async () => {
    const file = withPosition(vector3(false, false), { scriptClass: 'BakedThing' });
    expect((await parseBinaryResource(file)).properties.position).toBe('Vector3(1.5, -2, 0.25)');
  });

  it('writes an absolute node path with its subnames', async () => {
    const variant = new ByteWriter()
      .u32(VariantTag.NodePath)
      .u16(2)
      .u16(ABSOLUTE_NODE_PATH | 1)
      .u32(1)
      .u32(2)
      .u32(3)
      .bytes();
    const file = binaryResourceBytes({
      strings: ['target', 'root', 'Mesh', 'scale'],
      resources: [{ id: 'Main', type: 'Resource', properties: [{ name: 'target', variant }] }],
    });
    expect((await parseBinaryResource(file)).properties.target).toBe('NodePath("/root/Mesh:scale")');
  });

  it('reads a name the file writes inline rather than in its string table', async () => {
    const inlineName = new TextEncoder().encode('Mesh');
    const variant = new ByteWriter()
      .u32(VariantTag.NodePath)
      .u16(1)
      .u16(0)
      .u32(INLINE_STRING | inlineName.length)
      .raw(inlineName);
    const file = binaryResourceBytes({
      strings: ['target'],
      resources: [
        { id: 'Main', type: 'Resource', properties: [{ name: 'target', variant: variant.bytes() }] },
      ],
    });
    expect((await parseBinaryResource(file)).properties.target).toBe('NodePath("Mesh")');
  });

  it('keeps each internal resource before the main one as a sub-resource under its local id', async () => {
    const file = binaryResourceBytes({
      strings: ['size', 'mesh'],
      resources: [
        { id: 'BoxMesh_x1', type: 'BoxMesh', properties: [{ name: 'size', variant: vector3(false, false) }] },
        {
          id: 'Main',
          type: 'Resource',
          properties: [
            {
              name: 'mesh',
              variant: new ByteWriter().u32(VariantTag.Object).u32(ObjectRef.InternalResource).u32(0).bytes(),
            },
          ],
        },
      ],
    });
    const parsed = await parseBinaryResource(file);
    expect(parsed.properties.mesh).toBe('SubResource("BoxMesh_x1")');
    expect(parsed.subResources).toEqual([
      { id: 'BoxMesh_x1', type: 'BoxMesh', data: { size: 'Vector3(1.5, -2, 0.25)' } },
    ]);
  });

  it('resolves a reference in a file without named ids to the resource its number names', async () => {
    const reference = new ByteWriter().u32(VariantTag.Object).u32(ObjectRef.InternalResource).u32(2).bytes();
    const file = binaryResourceBytes({
      hasNamedIds: false,
      strings: ['size', 'mesh'],
      resources: [
        { id: '1', type: 'BoxMesh', properties: [] },
        { id: '2', type: 'BoxMesh', properties: [{ name: 'size', variant: vector3(false, false) }] },
        { id: '3', type: 'Resource', properties: [{ name: 'mesh', variant: reference }] },
      ],
    });
    expect((await parseBinaryResource(file)).properties.mesh).toBe('SubResource("2")');
  });

  it('writes the string keys of a dictionary in the order Godot writes them, not the file order', async () => {
    const stringKey = (key: string) => new ByteWriter().u32(VariantTag.String).unicodeString(key).bytes();
    const int = (value: number) => new ByteWriter().u32(VariantTag.Int).u32(value).bytes();
    const variant = new ByteWriter()
      .u32(VariantTag.Dictionary)
      .u32(2)
      .raw(stringKey('vertex_count'))
      .raw(int(24))
      .raw(stringKey('format'))
      .raw(int(7))
      .bytes();
    const file = binaryResourceBytes({
      strings: ['surface'],
      resources: [{ id: 'Main', type: 'Resource', properties: [{ name: 'surface', variant }] }],
    });
    expect((await parseBinaryResource(file)).properties.surface).toBe(
      '{\n"format": 7,\n"vertex_count": 24\n}'
    );
  });

  it('refuses a format version newer than Godot 4.6 reads (error case)', async () => {
    const file = withPosition(vector3(false, false), { formatVersion: 7 });
    await expect(parseBinaryResource(file)).rejects.toThrow(
      'expected a binary format version up to 6, got 7'
    );
  });

  it('refuses a file a newer engine major version saved (error case)', async () => {
    const file = withPosition(vector3(false, false), { engineMajor: 5 });
    await expect(parseBinaryResource(file)).rejects.toThrow(
      'expected a file saved by Godot 4 or older, got Godot 5'
    );
  });

  it('refuses a truncated file, naming the offset it stopped at', async () => {
    const file = withPosition(vector3(false, false)).slice(0, 40);
    await expect(parseBinaryResource(file)).rejects.toThrow(/expected \d+ more bytes at offset \d+/);
  });
});
