import { describe, expect, it } from 'vitest';
import { SVG_MIME_TYPE, imageMimeType } from './extensions';

describe('imageMimeType', () => {
  it('reads the MIME type of each image format by its extension', () => {
    expect([
      imageMimeType('res://crate.png'),
      imageMimeType('textures/grass.jpeg'),
      imageMimeType('icon.svg'),
    ]).toEqual(['image/png', 'image/jpeg', SVG_MIME_TYPE]);
  });

  it('reads a KTX2 file, which only a glTF names, as image/ktx2', () => {
    expect(imageMimeType('textures/rock.ktx2')).toBe('image/ktx2');
  });

  it('gives undefined for an unknown extension or none', () => {
    expect([imageMimeType('scene.bin'), imageMimeType('textures/README')]).toEqual([undefined, undefined]);
  });

  it('reads the extension case-insensitively (edge case)', () => {
    expect(imageMimeType('CRATE.PNG')).toBe('image/png');
  });
});
