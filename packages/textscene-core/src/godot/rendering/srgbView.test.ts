import { describe, expect, it } from 'vitest';
import { formatHasSrgbView } from './srgbView';

/** The formats `TextureStorage::_texture_2d_update` gives an sRGB format (`texture_storage.cpp:1874-2325`). */
const WITH_VIEW = [
  'RGB8',
  'RGBA8',
  'DXT1 RGB8',
  'DXT3 RGBA8',
  'DXT5 RGBA8',
  'BPTC_RGBA',
  'ETC',
  'ETC2_RGB8',
  'ETC2_RGBA8',
  'ETC2_RGB8A1',
  'ETC2_RA_AS_RG',
  'FORMAT_DXT5_RA_AS_RG',
  'ASTC_4x4',
  'ASTC_8x8',
];

/** Every other `Image::format_names` entry (`core/io/image.cpp:41-89`). */
const WITHOUT_VIEW = [
  'Lum8',
  'LumAlpha8',
  'Red8',
  'RedGreen',
  'RGBA4444',
  'RGBA5551',
  'RFloat',
  'RGFloat',
  'RGBFloat',
  'RGBAFloat',
  'RHalf',
  'RGHalf',
  'RGBHalf',
  'RGBAHalf',
  'RGBE9995',
  'RGTC Red8',
  'RGTC RedGreen8',
  'BPTC_RGBF',
  'BPTC_RGBFU',
  'ETC2_R11',
  'ETC2_R11S',
  'ETC2_RG11',
  'ETC2_RG11S',
  'ASTC_4x4_HDR',
  'ASTC_8x8_HDR',
  'R16',
  'RG16',
  'RGB16',
  'RGBA16',
  'R16Int',
  'RG16Int',
  'RGB16Int',
  'RGBA16Int',
];

describe('formatHasSrgbView', () => {
  it.each(WITH_VIEW)('gives %s an sRGB view', (format) => {
    expect(formatHasSrgbView(format)).toBe(true);
  });

  it.each(WITHOUT_VIEW)('gives %s none', (format) => {
    expect(formatHasSrgbView(format)).toBe(false);
  });

  it('gives a name Godot does not know none (error case)', () => {
    expect(formatHasSrgbView('rgb8')).toBe(false);
  });
});
