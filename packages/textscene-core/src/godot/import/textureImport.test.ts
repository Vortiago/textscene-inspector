import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_TEXTURE_IMPORT,
  hasTranslucentTexel,
  holdsRedGreenOnly,
  RoughnessChannel,
  roughnessLimitOption,
  textureImportFormat,
  type TextureCompressMode,
} from './textureImport';

const opaque = () => false;

const compression = (mode: TextureCompressMode, highQuality = false, normalMap = false) => ({
  ...DEFAULT_TEXTURE_IMPORT,
  mode,
  highQuality,
  normalMap,
});

describe('textureImportFormat', () => {
  it.each(['Lossless', 'Lossy', 'VramUncompressed'] as const)(
    'keeps a greyscale source in its own format under mode %s',
    (mode) => {
      expect(textureImportFormat('Lum8', compression(mode), opaque)).toBe('Lum8');
      expect(textureImportFormat('LumAlpha8', compression(mode), opaque)).toBe('LumAlpha8');
    }
  );

  it('keeps a colour source in its own format when lossless', () => {
    expect(textureImportFormat('RGB8', compression('Lossless'), opaque)).toBe('RGB8');
  });

  it('compresses an image with a translucent texel to DXT5 when VRAM compressed', () => {
    const vram = compression('VramCompressed');
    const translucent = () => true;
    expect(textureImportFormat('LumAlpha8', vram, translucent)).toBe('DXT5 RGBA8');
    expect(textureImportFormat('RGBA8', vram, translucent)).toBe('DXT5 RGBA8');
  });

  it('compresses an image whose texels are all opaque to DXT1, whatever its header says', () => {
    const vram = compression('VramCompressed');
    expect(textureImportFormat('LumAlpha8', vram, opaque)).toBe('DXT1 RGB8');
    expect(textureImportFormat('RGBA8', vram, opaque)).toBe('DXT1 RGB8');
  });

  it('compresses a source with no alpha channel to DXT1 without reading its texels (edge case)', () => {
    const vram = compression('VramCompressed');
    const unread = vi.fn(() => true);
    expect(textureImportFormat('Lum8', vram, unread)).toBe('DXT1 RGB8');
    expect(textureImportFormat('RGB8', vram, unread)).toBe('DXT1 RGB8');
    expect(unread).not.toHaveBeenCalled();
  });

  it('compresses to BPTC when VRAM compressed at high quality', () => {
    expect(textureImportFormat('Lum8', compression('VramCompressed', true), opaque)).toBe('BPTC_RGBA');
  });

  it('transcodes a Basis Universal import to BPTC', () => {
    expect(textureImportFormat('Lum8', compression('BasisUniversal'), opaque)).toBe('BPTC_RGBA');
    expect(textureImportFormat('RGBA8', compression('BasisUniversal'), opaque)).toBe('BPTC_RGBA');
  });

  it('compresses a normal map to RGTC, which has no sRGB view, under VRAM and Basis Universal', () => {
    expect(textureImportFormat('RGB8', compression('VramCompressed', false, true), opaque)).toBe(
      'RGTC RedGreen8'
    );
    expect(textureImportFormat('RGB8', compression('BasisUniversal', false, true), opaque)).toBe(
      'RGTC RedGreen8'
    );
  });

  it('keeps a lossless normal map in its source format (edge case)', () => {
    expect(textureImportFormat('RGB8', compression('Lossless', false, true), opaque)).toBe('RGB8');
  });
});

describe('holdsRedGreenOnly', () => {
  it('holds a normal map VRAM compressed or Basis Universal to red and green', () => {
    expect(holdsRedGreenOnly(compression('VramCompressed', false, true))).toBe(true);
    expect(holdsRedGreenOnly(compression('BasisUniversal', true, true))).toBe(true);
  });

  it('keeps every channel of an image that is no normal map', () => {
    expect(holdsRedGreenOnly(compression('VramCompressed'))).toBe(false);
  });

  it('keeps every channel of a normal map at high quality or lossless (edge case)', () => {
    expect(holdsRedGreenOnly(compression('VramCompressed', true, true))).toBe(false);
    expect(holdsRedGreenOnly(compression('Lossless', false, true))).toBe(false);
  });
});

describe('hasTranslucentTexel', () => {
  it('finds a texel whose alpha is below 0.999', () => {
    expect(hasTranslucentTexel(new Uint8Array([9, 9, 9, 255, 9, 9, 9, 128]))).toBe(true);
  });

  it('finds none in texels that are all opaque', () => {
    expect(hasTranslucentTexel(new Uint8Array([9, 9, 9, 255, 0, 0, 0, 255]))).toBe(false);
  });

  it('counts alpha 254, which is below 0.999, as translucent (edge case)', () => {
    expect(hasTranslucentTexel(new Uint8Array([9, 9, 9, 254]))).toBe(true);
  });
});

describe('roughnessLimitOption', () => {
  it('reads Red to Gray as the channel the limiter raises', () => {
    expect([2, 5, 6].map((mode) => roughnessLimitOption(mode, 'res://n.png')?.channel)).toEqual([
      RoughnessChannel.R,
      RoughnessChannel.A,
      RoughnessChannel.L,
    ]);
  });

  it('reads Detect, Disabled and a mode outside the enum as no limiter', () => {
    expect([0, 1, 7, undefined].map((mode) => roughnessLimitOption(mode, 'res://n.png'))).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it('reads a mode with no normal map as no limiter (edge case)', () => {
    expect([roughnessLimitOption(2, ''), roughnessLimitOption(2, undefined)]).toEqual([null, null]);
  });
});
