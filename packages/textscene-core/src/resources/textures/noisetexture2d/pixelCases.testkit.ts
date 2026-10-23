/**
 * The NoiseTexture2D inputs whose pixels are pinned by hash, shared by every path
 * that must produce the same bytes: the in-thread build, the worker job and the
 * shipped worker bundle. Each case moves one input of the pipeline.
 */
import { createHash } from 'node:crypto';
import type { MipLevel } from '../../processing/mipChain';
import { decodeFastNoiseLite } from '../../noise/fastnoiselite/decode';
import type { FastNoiseLiteData } from '../../noise/fastnoiselite/types';
import { gradientOf } from '../gradienttexture2d/gradient.testkit';
import type { Gradient } from '../gradienttexture2d/types';
import { decodeNoiseTexture2D } from './decode';
import type { NoiseTexture2DData } from './types';

export interface NoisePixelCase {
  name: string;
  tex: NoiseTexture2DData;
  noise: FastNoiseLiteData;
  colorRamp: Gradient | null;
}

const RAMP: Gradient = gradientOf({
  offsets: 'PackedFloat32Array(0, 0.6, 1)',
  colors: 'PackedColorArray(0.1, 0.2, 0.8, 1, 0.9, 0.5, 0.1, 0.5, 1, 1, 1, 1)',
});

const NOISE = decodeFastNoiseLite({ seed: '7', frequency: '0.08', fractal_type: '2' });

/** 33x17 unless `props` sizes it: odd and non-square, so a transposed or mis-flipped row shows. */
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
  noiseCase('five by three', { width: '5', height: '3' }),
  noiseCase('one texel wide', { width: '1', height: '6' }),
  noiseCase('one texel', { width: '1', height: '1' }),
  noiseCase('one texel tall', { width: '6', height: '1' }),
];

/**
 * SHA-256 of each level's bottom-up RGBA bytes, base first: `NoiseTexture2D.get_image()` after
 * `_generate_texture`, converted to RGBA8, in Godot 4.6.3 (`generate_mipmaps` on, the default).
 */
export const PINNED_LEVEL_HASHES: Readonly<Record<string, readonly string[]>> = {
  plain: [
    '9ffc20780ebeca805ac9071bff38106902bad800bcbdc514f8eda1261f489393', // 33x17
    'ee4b3f00afe65457a92e32a6a969c8c1dc00cf9a780e289f1c235c4713e58c4f', // 16x8
    '9fa503aaf1b574a47e5ffa94fe04eb1c72c52901e5408953582711801736037c', // 8x4
    '8d02ea4100e2768fa1bdfba53958d4ff51753738c99bd3f3ce6042c7773b3bcf', // 4x2
    'dcbec8623f55785887440989754cce36b9c50383428dfd90784687206c7fea21', // 2x1
    '1ad56bdbe699910f47e0c2094f008c9b993c2c1f2bbc60283039dadbc7a05053', // 1x1
  ],
  'plain inverted': [
    '12824c1681f8db9b0c876ac4a2c026fd94cb3036ecead7ebaaa513d39839cd3b', // 33x17
    'f07cdc7e86b0575d0ce8380e754f3cd14034b4c03872da445b6e5e1f8bdb31ee', // 16x8
    'c7ca2fe02d67ffc934977271a9206fe99ab4ba903dca44643415bcf71d6c9562', // 8x4
    '7ee2c7cdfc893cd8d60c159dba11dc571a6e22066860b89a8dad02f475d06733', // 4x2
    'ce3d8b1dbea3f70b6ece91f387e25a6ee8718b0064232a69658183f6135d6698', // 2x1
    'bcd85208d8b4bf9f4a44a979719b18f5f4d0253ff62a9a8d682855f4a28f283f', // 1x1
  ],
  'raw range': [
    'a467d08140e2e13ed7279a3f857e99df6a61dcd60b66bc60ab33b0e29ac182ee', // 33x17
    '44f081cacd99266fe52d4accb0cff381f92842e5d4efb6c887c219d0b460dd2b', // 16x8
    '9b434cbe413bdbe4d73f843a966326fd483149e0d9326fb27d46acf613982735', // 8x4
    '3f10398751da2fb2391664f543af3d6b9e140f0a99daf8a764b9bb959735eda4', // 4x2
    'f7f6d76228a449e40c8deeb47ae602aca046abdcdddfec2b964784b94d1c171f', // 2x1
    'c44f9aac7e7c70813794d710f59571f3f0a968530dcc92cc6bd576c6c22ae017', // 1x1
  ],
  'raw range inverted': [
    'bdb9ef419fc55020214f39ae977f94c403e04e67f495658050ed8a918443a3ec', // 33x17
    '240db6d3b384cf4e9ce341b02c4ffee3b630c7db182c7bae60d6fb2969634edc', // 16x8
    'abb39fb8611745ef055b73c1331395ee372d20dbe68a6c6dc3e51df975d68803', // 8x4
    '6e4201acd130f0cb6e3f1314f842b14cd4b2eab724586173f57f634375f1ed57', // 4x2
    '50499a32438102a52ed742eeeec8b5dfb570d9888e3ecadea61ba405662d2f0f', // 2x1
    '38868b46cb68cd30d88c9fe090601b29b9950cbc075009d7425a4a1bfc95f871', // 1x1
  ],
  seamless: [
    '94a9a2cdf89e78a485fc8abe8b1836837606eb5ffc00e71233d14980e52e226f', // 33x17
    'b837f2d34177167225f8c8644a9704c8388e76771f238d47dcb5500fff08de81', // 16x8
    'af46c09cb99d6ea1d8ffa801efbfa008fc157ccaf9517b0aa345d768fcd442b3', // 8x4
    '6c01a991529516a2b6cd62ea60ea4424b74bd49a32c1d4b1f54db055193408a7', // 4x2
    '052d152b344a881af3c60dd7a0061f12f4adb52570799b9d5d57202e810bae94', // 2x1
    '1b329170a887a6f72094dcfad111b2756f714ee42a538d8b5c14188547ecb507', // 1x1
  ],
  'seamless inverted': [
    'e318101f675047943e5bb3e150e52c1174c93dcae05647fc64413dbfc84788c3', // 33x17
    'b5431569a524d36f8683c573ab7b789b1261bf7ff98611144158362055c38952', // 16x8
    'a674cd8e0a0aafd0f3f816e96b642c337450dc2bd96f4838f23f510b31126d60', // 8x4
    'ae253a042a671d787950dd446bb49720427055a22dc79809c0c1b172794279fd', // 4x2
    '7b07338158c25824406b4a11571e3e78e80c69524d0cea863943979302b4a951', // 2x1
    '3ec89e14a0821bb5838a03f9bb56e817b1a12c57a2b1eb60935ded0655c99d78', // 1x1
  ],
  'seamless raw range': [
    '599a0b00113d3ca75e688a1fb71142e3c3517e085a7955635e9445381c2ea4a9', // 33x17
    'c68f55fec815ed0a8fe1c328db119ee8a46cc7ab040b0419e449a26db8034ae0', // 16x8
    '138f1dcc1eeb923958f983d03ca19dc09672741e089044617e7fa55641ddd333', // 8x4
    '5a55792c487c36f7dcd9cd2772ebbead5cc87ef9ec96f40b21f7d6cf1b75dcf0', // 4x2
    '2b2c4362751ef07b4943e2e480b8545265eee8130ca0aae1c3c9fff5d1b26ea3', // 2x1
    '9b83ea03b21c3342b1827284f2b1a1409fede9fc0e38a2e54a9e801ea458ecc2', // 1x1
  ],
  'seamless minimum skirt': [
    'cc49240cd00fc2127562311c933a1d07d29b40df15e407fce25d8c3de297084a', // 33x17
    '5f3867576473265a21911f30aaf136ea0ea6f48b9027a036c420b570ff288bf3', // 16x8
    'e0add6992a425a1bd3a130a838760b9211a266ec62d1b60e0048ce8c17eb08db', // 8x4
    '3eea5f6ddf85e0aa8cf72b0030d4333625a933d04bc4dd5011556b98c3470608', // 4x2
    '052d152b344a881af3c60dd7a0061f12f4adb52570799b9d5d57202e810bae94', // 2x1
    '1b329170a887a6f72094dcfad111b2756f714ee42a538d8b5c14188547ecb507', // 1x1
  ],
  'seamless skirt past half': [
    'e965753eab458f07f4a67da10b7c863d7c02039595d3c96a1ccff87a4559517b', // 33x17
    '6d02a044008336da8c81900e17ad58fc08299df709afbe4e3579de839bd91d27', // 16x8
    '22950c4a399ce804735ecefd7dfdb65d4612bb815860e762345fe2f9f5cc33b2', // 8x4
    '00e42b856dfb907422482e13f18f41a5fe4b0a646e7d4b76a2d5e9c0d89851dd', // 4x2
    'b5e37492d6d4a27d958f256337fefe4e2b19c89ca4f3473add5cea4161347632', // 2x1
    '35ef016ff1634598e9541c238f6ebed9d7e19b7c65bf756864144473ce225c78', // 1x1
  ],
  'colour ramp': [
    'e22ddba9837fe70c5d9247d6f5397f06a8a7212d4fd4c746e7ebdf37eb417fbd', // 33x17
    'd4abaebeccc366907d79b1046e1ddaea91f2ddb0b0df51bedda2297ae35e1ced', // 16x8
    '744f85bdcdd07953080cce84f4daed6c233b686eb1d067907994bc262c7dd444', // 8x4
    'c91df926f1de2b100e2d7ab76f96cc97b8f8e39d4b0b8372a6c0a502c5ca3357', // 4x2
    '06e2140101bef0f8c9f21cc7d71e4e0ad8fc0d66204ee98fc5a17d7ae92f771e', // 2x1
    'c22cae781e409de1cd153fe8e4db4956bfc205639bca90803b0321907d36aa01', // 1x1
  ],
  'normal map': [
    '28e6f7bfec700912222420c7aa61a04d2f2f31168822730ccc2f1ead9d637050', // 33x17
    'b2b6d45299fa36c28296e31ee180502c7e2c5ab8f4f8d81589094d78cd05fd59', // 16x8
    '5ee8c2a0f0a85a33ce26e191bb321fa9a3e18e76119076a25d0f4a5f6bbd0e7b', // 8x4
    '251436c0f1ecf45f2c0f4a0d0f13055479958f14c75e065b63424fa4cecc782d', // 4x2
    '93d2d8724301764c051a70954077b574c7fb46798fa1456b5f701159b05b93e4', // 2x1
    'ab63ebd5e623f575b1d79250d55f77f1d475c2f135ed897998057d0de0c17c62', // 1x1
  ],
  'normal map over a ramp': [
    '20b2b5e68ecb159bad9e76cf7602aff9c00701552f0b8487c0732b746b40a8b2', // 33x17
    '2d612eb98dc6b04194d3d7a18f1d57cb08e03dd477516e329488743a94648def', // 16x8
    'ec7e0d4606c4e776e28efbaeeea5743d7b304ab82d76578771e4a0dd64abde67', // 8x4
    '1c00983297d7c5f364d6ac19ada25d38fecfee0e9ab5e3d736d100ca0cfc6659', // 4x2
    'e82c879de2d34ddf8457fdd50458c4fbe4762d028fc5e9fa7db422bd3e9f8bed', // 2x1
    'b628c0c7afb88767268b8b7f9904eed2ee2580837e0f2454503922029b62b3d0', // 1x1
  ],
  'five by three': [
    'bcbfecba48dcd93ef5a0b2eef6825d374b0e6bd99ce86ca6a842eacbbf121d40', // 5x3
    '3e72ff78022a5489b11563c563cfc596ef9ebcf50853cf4a87470113d214c659', // 2x1
    '14d0ce0dd97c7ff5cb99441321d83a755edefd342f94b0018e17c7eb44346e42', // 1x1
  ],
  'one texel wide': [
    '41612067cb82466e6520a623b0d5d2f48b656e884d0ebcc4046f5787850d3249', // 1x6
    '5b3c83a4b8827da4ac68905b9ca13cec7f4d0e0cf512dc1b2642482497bf6b23', // 1x3
    '87e844e32ba174d7c4ffbaf76292a763e787424e50a5548729fe9289b7202f6c', // 1x1
  ],
  'one texel': [
    'e3820096cb82366b860b8a4e668453a7aaaf423af03bdf289fa308ea03a79332', // 1x1
  ],
  'one texel tall': [
    '13cfd58fc3d5f4a4519ab71ba757bf6a123b129e51a7cb08d72e7ffc4a766b4e', // 6x1
    '9d32efb2aff7c5209c409f6afb439261b3e480eb6b31f421d98b53e0e23ae96c', // 3x1
    '5d99bebb39884386b0bfa9219bff14ef27c391c53f638fcc689f899c8a99b835', // 1x1
  ],
};

/** SHA-256 of each case's base level, the bytes `generate_mipmaps` off leaves. */
export const PINNED_PIXEL_HASHES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(PINNED_LEVEL_HASHES).map(([name, [base]]) => [name, base!])
);

/** The SHA-256 of each level's bytes, base first: the shape `PINNED_LEVEL_HASHES` pins. */
export function levelHashes(levels: readonly Pick<MipLevel, 'data'>[]): string[] {
  return levels.map(({ data }) => createHash('sha256').update(data).digest('hex'));
}
