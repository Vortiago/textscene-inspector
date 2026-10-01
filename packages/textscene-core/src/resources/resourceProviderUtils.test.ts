/**
 * `isBinaryResourceType` derives its answer from the resource-slice claim table
 * (ADR-0031). This suite enumerates every binary type name and extension, so
 * the derivation provably keeps each answer.
 */

import { describe, expect, it } from 'vitest';
import { isBinaryResourceType, resourceContent, stripResPrefix } from './resourceProviderUtils';
import { resourceSliceRegistry } from './sliceRegistration';

/** The binary type names a provider must fetch as bytes. */
const BINARY_TYPES = [
  'Texture2D',
  'CompressedTexture2D',
  'ImageTexture',
  'AudioStream',
  'AudioStreamWAV',
  'AudioStreamOggVorbis',
  'AudioStreamMP3',
];

/**
 * The binary extensions, dot-prefixed, plus the raw font
 * containers. `FontFile` is deliberately absent from the type list above: the
 * type name is not a binary signal, because a `FontFile` ExtResource as often
 * names a text `.tres` wrapper. The extension is.
 */
const BINARY_EXTENSIONS = [
  '.glb',
  '.gltf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.svg',
  '.wav',
  '.ogg',
  '.mp3',
  '.ttf',
  '.otf',
  '.woff',
  '.woff2',
];

describe('isBinaryResourceType', () => {
  it('answers true for every type name the hardcoded list carried', () => {
    for (const type of BINARY_TYPES) {
      expect(isBinaryResourceType(type)).toBe(true);
    }
  });

  it('answers true for every extension the hardcoded list carried', () => {
    for (const extension of BINARY_EXTENSIONS) {
      expect(isBinaryResourceType('Unknown', `res://assets/file${extension}`)).toBe(true);
      expect(isBinaryResourceType('Unknown', `res://assets/FILE${extension.toUpperCase()}`)).toBe(true);
    }
  });

  it('takes the image and GLB answers from the slice claims, not a list', () => {
    // Unregister-and-retest is not possible, so pin that the registry carries
    // these claims.
    expect(resourceSliceRegistry.byExtension('.png')?.slice).toBe('image');
    expect(resourceSliceRegistry.byExtension('.glb')?.slice).toBe('glb');
    expect(resourceSliceRegistry.byTypeName('Texture2D')?.binaryBytes).toBe(true);
  });

  it('treats type and path as independent signals', () => {
    // A PackedScene pointing at a .glb: the type is claimed and textual, the
    // file is bytes. Short-circuiting on the type claim would break this.
    expect(isBinaryResourceType('PackedScene', 'res://models/rock.glb')).toBe(true);
  });

  it('does not read "a slice claimed this extension" as "binary"', () => {
    expect(resourceSliceRegistry.byExtension('.tscn')?.slice).toBe('packedscene');
    expect(isBinaryResourceType('Whatever', 'res://scenes/level.tscn')).toBe(false);
  });

  it('answers false for the text resources a provider must fetch as strings', () => {
    expect(isBinaryResourceType('PackedScene')).toBe(false);
    expect(isBinaryResourceType('PackedScene', 'res://scenes/level.tscn')).toBe(false);
    expect(isBinaryResourceType('StandardMaterial3D', 'res://art/glass.tres')).toBe(false);
    expect(isBinaryResourceType('Script', 'res://src/player.gd')).toBe(false);
    expect(isBinaryResourceType('')).toBe(false);
  });

  it('ignores a dot that belongs to a directory rather than a file', () => {
    expect(isBinaryResourceType('Unknown', 'res://dir.v2/model')).toBe(false);
  });

  it('does not treat a query-suffixed extension as one', () => {
    // "glb?v=2" is not the `.glb` extension.
    expect(isBinaryResourceType('Unknown', 'res://models/rock.glb?v=2')).toBe(false);
  });

  it('needs a real extension: a bare "glb" filename is not one', () => {
    // The single intentional divergence from the hardcoded lists, which took
    // `path.split('.').pop()` and so answered true for the dotless string
    // "glb". No provider can produce such a path.
    expect(isBinaryResourceType('Unknown', 'glb')).toBe(false);
    expect(isBinaryResourceType('Unknown', 'res://models/glb')).toBe(false);
  });

  it('answers false for an unclaimed type with no path', () => {
    expect(isBinaryResourceType('Curve')).toBe(false);
  });
});

describe('stripResPrefix', () => {
  it('drops the res:// prefix', () => {
    expect(stripResPrefix('res://scenes/Door.tscn')).toBe('scenes/Door.tscn');
  });

  it('leaves a path that has no prefix alone', () => {
    expect(stripResPrefix('scenes/Door.tscn')).toBe('scenes/Door.tscn');
    expect(stripResPrefix('')).toBe('');
  });
});

describe('resourceContent', () => {
  it('decodes a text resource as UTF-8', () => {
    const bytes = new TextEncoder().encode('[gd_scene format=3]\n');
    expect(resourceContent(bytes, 'PackedScene', 'res://level.tscn')).toBe('[gd_scene format=3]\n');
  });

  it('hands a binary resource back as an ArrayBuffer holding exactly its bytes', () => {
    const content = resourceContent(
      new Uint8Array([0x67, 0x6c, 0x54, 0x46]),
      'PackedScene',
      'res://tree.glb'
    );

    expect(content).toBeInstanceOf(ArrayBuffer);
    expect([...new Uint8Array(content as ArrayBuffer)]).toEqual([0x67, 0x6c, 0x54, 0x46]);
  });

  it('copies a view out of a larger buffer, so the other bytes stay behind', () => {
    const pool = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const content = resourceContent(pool.subarray(2, 4), 'Texture2D', 'res://icon.png');

    expect((content as ArrayBuffer).byteLength).toBe(2);
    expect([...new Uint8Array(content as ArrayBuffer)]).toEqual([3, 4]);
  });

  it('gives an empty string for an empty text file', () => {
    expect(resourceContent(new Uint8Array(), '', 'res://project.godot')).toBe('');
  });
});
