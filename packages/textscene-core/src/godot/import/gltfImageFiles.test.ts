import { describe, expect, it } from 'vitest';
import { gltfImageFiles, gltfImageSourceFormat } from './gltfImageFiles';
import { jpeg, png } from '../../resources/formats/image/testing/imageBytes';

describe('gltfImageFiles', () => {
  it('extracts an embedded PNG beside the glTF as <basename>_<image name>.png', () => {
    const [file] = gltfImageFiles('res://props/crate.glb', [{ name: 'albedo', mimeType: 'image/png' }]);
    expect(file).toEqual({ uri: null, extracted: 'res://props/crate_albedo.png' });
  });

  it('extracts an embedded JPEG as .jpg', () => {
    const [file] = gltfImageFiles('res://crate.glb', [{ name: 'albedo', mimeType: 'image/jpeg' }]);
    expect(file!.extracted).toBe('res://crate_albedo.jpg');
  });

  it('extracts an image of no known MIME type as .png, which Godot writes it as', () => {
    const [file] = gltfImageFiles('res://crate.glb', [{ name: 'albedo' }]);
    expect(file!.extracted).toBe('res://crate_albedo.png');
  });

  it('names an unnamed image by its index', () => {
    const files = gltfImageFiles('res://crate.glb', [
      { name: 'a', mimeType: 'image/png' },
      { mimeType: 'image/png' },
    ]);
    expect(files[1]!.extracted).toBe('res://crate_1.png');
  });

  it('suffixes a repeated name with the index', () => {
    const files = gltfImageFiles('res://crate.glb', [
      { name: 'tex', mimeType: 'image/png' },
      { name: 'tex', mimeType: 'image/png' },
    ]);
    expect(files.map((file) => file.extracted)).toEqual(['res://crate_tex.png', 'res://crate_tex_1.png']);
  });

  it('reduces an image name to a valid file base name', () => {
    const [file] = gltfImageFiles('res://crate.glb', [{ name: 'maps/wood:old.png', mimeType: 'image/png' }]);
    expect(file!.extracted).toBe('res://crate_wood_old.png');
  });

  it('drops two extensions from the glTF file name, as the importer takes the base name twice', () => {
    const [file] = gltfImageFiles('res://crate.v2.glb', [{ name: 'a', mimeType: 'image/png' }]);
    expect(file!.extracted).toBe('res://crate_a.png');
  });

  it('gives an external image its own file, relative to the glTF', () => {
    const [file] = gltfImageFiles('res://props/crate.gltf', [{ uri: 'textures/wood%20grain.png' }]);
    expect(file!.uri).toBe('textures/wood%20grain.png');
  });

  it('extracts a data URI image like an embedded one', () => {
    const [file] = gltfImageFiles('res://crate.gltf', [{ name: 'a', uri: 'data:image/png;base64,AAAA' }]);
    expect(file).toEqual({ uri: null, extracted: 'res://crate_a.png' });
  });
});

describe('gltfImageSourceFormat', () => {
  it('reads the bytes by the MIME type the glTF names', () => {
    expect(gltfImageSourceFormat(png(0), 'image/png')).toBe('Lum8');
  });

  it('reads an image of no MIME type as a PNG, then as a JPEG', () => {
    expect(gltfImageSourceFormat(png(0), undefined)).toBe('Lum8');
    expect(gltfImageSourceFormat(jpeg(1), undefined)).toBe('Lum8');
  });

  it('reads a JPEG the glTF calls a PNG as a JPEG', () => {
    expect(gltfImageSourceFormat(jpeg(3), 'image/png')).toBe('RGB8');
  });

  it('reads nothing from bytes that are no image', () => {
    expect(gltfImageSourceFormat(new Uint8Array([1, 2, 3]), 'image/png')).toBeNull();
  });
});
