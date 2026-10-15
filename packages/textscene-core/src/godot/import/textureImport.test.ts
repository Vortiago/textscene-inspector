import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TEXTURE_IMPORT,
  TextureCompressMode,
  holdsRedGreenOnly,
  textureImportFormat,
} from './textureImport';

const compression = (mode: TextureCompressMode, highQuality = false, normalMap = false) => ({
  ...DEFAULT_TEXTURE_IMPORT,
  mode,
  highQuality,
  normalMap,
});

describe('textureImportFormat', () => {
  it.each([TextureCompressMode.Lossless, TextureCompressMode.Lossy, TextureCompressMode.VramUncompressed])(
    'keeps a greyscale source in its own format under mode %i',
    (mode) => {
      expect(textureImportFormat('Lum8', compression(mode))).toBe('Lum8');
      expect(textureImportFormat('LumAlpha8', compression(mode))).toBe('LumAlpha8');
    }
  );

  it('keeps a colour source in its own format when lossless', () => {
    expect(textureImportFormat('RGB8', compression(TextureCompressMode.Lossless))).toBe('RGB8');
  });

  it('compresses an opaque source to DXT1 and one with alpha to DXT5 when VRAM compressed', () => {
    const vram = compression(TextureCompressMode.VramCompressed);
    expect(textureImportFormat('Lum8', vram)).toBe('DXT1 RGB8');
    expect(textureImportFormat('RGB8', vram)).toBe('DXT1 RGB8');
    expect(textureImportFormat('LumAlpha8', vram)).toBe('DXT5 RGBA8');
    expect(textureImportFormat('RGBA8', vram)).toBe('DXT5 RGBA8');
  });

  it('compresses to BPTC when VRAM compressed at high quality', () => {
    expect(textureImportFormat('Lum8', compression(TextureCompressMode.VramCompressed, true))).toBe(
      'BPTC_RGBA'
    );
  });

  it('transcodes a Basis Universal import to BPTC', () => {
    expect(textureImportFormat('Lum8', compression(TextureCompressMode.BasisUniversal))).toBe('BPTC_RGBA');
    expect(textureImportFormat('RGBA8', compression(TextureCompressMode.BasisUniversal))).toBe('BPTC_RGBA');
  });

  it('compresses a normal map to RGTC, which has no sRGB view, under VRAM and Basis Universal', () => {
    expect(textureImportFormat('RGB8', compression(TextureCompressMode.VramCompressed, false, true))).toBe(
      'RGTC RedGreen8'
    );
    expect(textureImportFormat('RGB8', compression(TextureCompressMode.BasisUniversal, false, true))).toBe(
      'RGTC RedGreen8'
    );
  });

  it('keeps a lossless normal map in its source format (edge case)', () => {
    expect(textureImportFormat('RGB8', compression(TextureCompressMode.Lossless, false, true))).toBe('RGB8');
  });
});

describe('holdsRedGreenOnly', () => {
  it('holds a normal map VRAM compressed or Basis Universal to red and green', () => {
    expect(holdsRedGreenOnly(compression(TextureCompressMode.VramCompressed, false, true))).toBe(true);
    expect(holdsRedGreenOnly(compression(TextureCompressMode.BasisUniversal, true, true))).toBe(true);
  });

  it('keeps every channel of an image that is no normal map', () => {
    expect(holdsRedGreenOnly(compression(TextureCompressMode.VramCompressed))).toBe(false);
  });

  it('keeps every channel of a normal map at high quality or lossless (edge case)', () => {
    expect(holdsRedGreenOnly(compression(TextureCompressMode.VramCompressed, true, true))).toBe(false);
    expect(holdsRedGreenOnly(compression(TextureCompressMode.Lossless, false, true))).toBe(false);
  });
});
