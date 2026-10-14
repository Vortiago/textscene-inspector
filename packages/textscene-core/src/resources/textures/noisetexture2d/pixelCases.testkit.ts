/**
 * The NoiseTexture2D inputs whose pixels are pinned by hash, shared by every path
 * that must produce the same bytes: the in-thread build, the worker job and the
 * shipped worker bundle. Each case moves one input of the pipeline.
 */
import { decodeFastNoiseLite } from '../../noise/fastnoiselite/decode';
import type { FastNoiseLiteData } from '../../noise/fastnoiselite/types';
import { decodeGradient } from '../gradienttexture2d/decode';
import type { Gradient } from '../gradienttexture2d/types';
import { decodeNoiseTexture2D } from './decode';
import type { NoiseTexture2DData } from './types';

export interface NoisePixelCase {
  name: string;
  tex: NoiseTexture2DData;
  noise: FastNoiseLiteData;
  colorRamp: Gradient | null;
}

const RAMP: Gradient = decodeGradient({
  offsets: 'PackedFloat32Array(0, 0.6, 1)',
  colors: 'PackedColorArray(0.1, 0.2, 0.8, 1, 0.9, 0.5, 0.1, 0.5, 1, 1, 1, 1)',
});

const NOISE = decodeFastNoiseLite({ seed: '7', frequency: '0.08', fractal_type: '2' });

/** 33x17: odd and non-square, so a transposed or mis-flipped row shows. */
function noiseCase(name: string, props: Record<string, string>, colorRamp: Gradient | null = null) {
  return {
    name,
    tex: decodeNoiseTexture2D({ width: '33', height: '17', ...props }),
    noise: NOISE,
    colorRamp,
  };
}

export const NOISE_PIXEL_CASES: readonly NoisePixelCase[] = [
  noiseCase('plain', {}),
  noiseCase('plain inverted', { invert: 'true' }),
  noiseCase('raw range', { normalize: 'false' }),
  noiseCase('raw range inverted', { normalize: 'false', invert: 'true' }),
  noiseCase('seamless', { seamless: 'true' }),
  noiseCase('seamless inverted', { seamless: 'true', invert: 'true' }),
  noiseCase('seamless raw range', { seamless: 'true', normalize: 'false' }),
  noiseCase('seamless minimum skirt', { seamless: 'true', seamless_blend_skirt: '0.0' }),
  noiseCase('seamless skirt past half', { seamless: 'true', seamless_blend_skirt: '0.7' }),
  noiseCase('colour ramp', {}, RAMP),
  noiseCase('normal map', { as_normal_map: 'true', bump_strength: '5.0' }),
  noiseCase('normal map over a ramp', { as_normal_map: 'true' }, RAMP),
];

/** SHA-256 of each case's bottom-up RGBA bytes: the bytes Godot's pipeline order gives. */
export const PINNED_PIXEL_HASHES: Readonly<Record<string, string>> = {
  plain: '9ffc20780ebeca805ac9071bff38106902bad800bcbdc514f8eda1261f489393',
  'plain inverted': '12824c1681f8db9b0c876ac4a2c026fd94cb3036ecead7ebaaa513d39839cd3b',
  'raw range': 'a467d08140e2e13ed7279a3f857e99df6a61dcd60b66bc60ab33b0e29ac182ee',
  'raw range inverted': 'bdb9ef419fc55020214f39ae977f94c403e04e67f495658050ed8a918443a3ec',
  seamless: '94a9a2cdf89e78a485fc8abe8b1836837606eb5ffc00e71233d14980e52e226f',
  'seamless inverted': 'e318101f675047943e5bb3e150e52c1174c93dcae05647fc64413dbfc84788c3',
  'seamless raw range': '599a0b00113d3ca75e688a1fb71142e3c3517e085a7955635e9445381c2ea4a9',
  'seamless minimum skirt': 'cc49240cd00fc2127562311c933a1d07d29b40df15e407fce25d8c3de297084a',
  'seamless skirt past half': 'e965753eab458f07f4a67da10b7c863d7c02039595d3c96a1ccff87a4559517b',
  'colour ramp': 'e22ddba9837fe70c5d9247d6f5397f06a8a7212d4fd4c746e7ebdf37eb417fbd',
  'normal map': '28e6f7bfec700912222420c7aa61a04d2f2f31168822730ccc2f1ead9d637050',
  'normal map over a ramp': '20b2b5e68ecb159bad9e76cf7602aff9c00701552f0b8487c0732b746b40a8b2',
};
