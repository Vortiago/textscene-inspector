import { INSTRUCTION_TABLE } from '../../../../packages/textscene-core/src/shaders/language/instructionTable.generated.ts';
import { probeOf } from './languageProbes.mjs';

const hex = (bytes) => bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');

const levelSize = (size, level) => Math.max(size >> level, 1);

/** Distinct bytes for each texel, layer and level, so a read names the texel it came from. */
const texelOf = (x, y, layer, level) => [
  (16 * x + 3 * layer + 1) & 255,
  (64 * y + 40 * level + 2) & 255,
  (7 * x + 3 * y + 50 * layer + 5) & 255,
  (255 - 20 * x - 9 * level) & 255,
];

/** A texture both harnesses build: each level's RGBA8 bytes, its layers in a row, down to 1 texel. */
export function textureSpec(kind, width, height, { depth = 1, isMipmapped = false } = {}) {
  const count = kind === 'cube' ? 6 : depth;
  const levelCount = isMipmapped ? Math.floor(Math.log2(Math.max(width, height))) + 1 : 1;
  const levels = Array.from({ length: levelCount }, (_, level) => {
    const layers = kind === 'volume' ? levelSize(count, level) : count;
    const bytes = [];
    for (let layer = 0; layer < layers; layer++)
      for (let y = 0; y < levelSize(height, level); y++)
        for (let x = 0; x < levelSize(width, level); x++) bytes.push(...texelOf(x, y, layer, level));
    return hex(bytes);
  });
  return { kind, width, height, ...(kind === 'flat' || kind === 'cube' ? {} : { depth }), levels };
}

/** A probe whose material sets `textures`, a spec or a list of them per sampler, with `inputs` rows. */
function textureProbe(name, rows, source, { textures = {}, inputs, hdr2d } = {}) {
  const probe = probeOf(`texture-${name}`, ['uniform', ...rows], source);
  return {
    ...probe,
    ...(inputs === undefined ? {} : { inputs }),
    textures,
    ...(hdr2d ? { hdr2d: true } : {}),
  };
}

const FLAT = textureSpec('flat', 4, 2);
const MIPMAPPED = textureSpec('flat', 4, 4, { isMipmapped: true });

/** Texel centres, texel edges and coordinates outside the texture, across a 4 by 2 texture. */
const UVS = [
  [0.125, 0.25],
  [0.375, 0.75],
  [0.875, 0.25],
  [0.25, 0.5],
  [0.5, 0.25],
  [0.3, 0.6],
  [1.125, 0.25],
  [-0.125, 0.75],
  [0.0, 0.0],
  [1.0, 1.0],
];

const uvRows = (uvs) => uvs.map((uv) => [uv]);

/** Each filter word, then the default of the harness's canvas_item, which is filter_linear. */
function filterProbes() {
  const filters = [
    'filter_nearest',
    'filter_linear',
    'filter_nearest_mipmap',
    'filter_linear_mipmap',
    'filter_nearest_mipmap_anisotropic',
    'filter_linear_mipmap_anisotropic',
  ];
  return [
    ...filters.map((filter) =>
      textureProbe(
        `2d-${filter}`,
        ['sampler2D', filter, 'texture(sampler2D,vec2)'],
        `uniform sampler2D s : ${filter};\nvec4 probe(vec2 uv) { return texture(s, uv); }`,
        { textures: { s: FLAT }, inputs: uvRows(UVS) }
      )
    ),
    textureProbe(
      '2d-default-filter',
      ['sampler2D', 'texture(sampler2D,vec2)'],
      'uniform sampler2D s;\nvec4 probe(vec2 uv) { return texture(s, uv); }',
      { textures: { s: FLAT }, inputs: uvRows(UVS) }
    ),
    textureProbe(
      '2d-repeat-enable',
      ['sampler2D', 'filter_nearest', 'repeat_enable', 'texture(sampler2D,vec2)'],
      'uniform sampler2D s : filter_nearest, repeat_enable;\nvec4 probe(vec2 uv) { return texture(s, uv); }',
      { textures: { s: FLAT }, inputs: uvRows(UVS) }
    ),
    textureProbe(
      '2d-repeat-disable',
      ['sampler2D', 'filter_nearest', 'repeat_disable', 'texture(sampler2D,vec2)'],
      'uniform sampler2D s : filter_nearest, repeat_disable;\nvec4 probe(vec2 uv) { return texture(s, uv); }',
      { textures: { s: FLAT }, inputs: uvRows(UVS) }
    ),
  ];
}

/** Each default texture a sampler reads while the material sets none. */
function defaultProbes() {
  const hints = [
    '',
    ' : hint_default_white',
    ' : hint_default_black',
    ' : hint_default_transparent',
    ' : hint_normal',
    ' : hint_roughness_normal',
    ' : hint_anisotropy',
    ' : hint_roughness_r',
  ];
  const unset = hints.map((hint) =>
    textureProbe(
      `unset${hint.replace(' : ', '-') || '-none'}`,
      ['sampler2D', 'texture(sampler2D,vec2)', ...(hint ? [hint.slice(3)] : [])],
      `uniform sampler2D s${hint};\nvec4 probe() { return texture(s, vec2(0.5)); }`
    )
  );
  return [
    ...unset,
    textureProbe(
      'set-null-default-black',
      ['sampler2D', 'texture(sampler2D,vec2)', 'hint_default_black'],
      'uniform sampler2D s : hint_default_black;\nvec4 probe() { return texture(s, vec2(0.5)); }',
      { textures: { s: null } }
    ),
    textureProbe(
      'unset-external-array',
      ['samplerExternalOES', 'texture(samplerExternalOES,vec2)'],
      'uniform samplerExternalOES s[2];\nvec4 probe() { return texture(s[0], vec2(0.5)) + texture(s[1], vec2(0.5)) * 2.0; }'
    ),
  ];
}

/** Reads of a mipmapped 4 by 4 texture: a level, a texel, a size. */
function levelProbes() {
  return [
    textureProbe(
      '2d-lod',
      ['sampler2D', 'filter_nearest_mipmap', 'textureLod(sampler2D,vec2,float)'],
      'uniform sampler2D s : filter_nearest_mipmap;\nvec4 probe(vec2 uv, float lod) { return textureLod(s, uv, lod); }',
      {
        textures: { s: MIPMAPPED },
        inputs: [
          [[0.375, 0.625], 0],
          [[0.375, 0.625], 1],
          [[0.375, 0.625], 2],
          [[0.375, 0.625], 0.6],
          [[0.9, 0.1], 5],
        ],
      }
    ),
    textureProbe(
      '2d-lod-linear-mipmap',
      ['sampler2D', 'filter_linear_mipmap', 'textureLod(sampler2D,vec2,float)'],
      'uniform sampler2D s : filter_linear_mipmap;\nvec4 probe(vec2 uv, float lod) { return textureLod(s, uv, lod); }',
      {
        textures: { s: MIPMAPPED },
        inputs: [
          [[0.375, 0.625], 0.25],
          [[0.375, 0.625], 0.5],
          [[0.375, 0.625], 1.75],
        ],
      }
    ),
    textureProbe(
      '2d-lod-linear-no-mipmap-filter',
      ['sampler2D', 'filter_linear', 'textureLod(sampler2D,vec2,float)'],
      'uniform sampler2D s : filter_linear;\nvec4 probe(vec2 uv, float lod) { return textureLod(s, uv, lod); }',
      {
        textures: { s: MIPMAPPED },
        inputs: [
          [[0.375, 0.625], 0.25],
          [[0.375, 0.625], 1.0],
          [[0.375, 0.625], 1.75],
        ],
      }
    ),
    textureProbe(
      '2d-texel-fetch',
      ['sampler2D', 'texelFetch(sampler2D,ivec2,int)'],
      'uniform sampler2D s;\nvec4 probe(ivec2 texel, int lod) { return texelFetch(s, texel, lod); }',
      {
        textures: { s: MIPMAPPED },
        inputs: [
          [[0, 0], 0],
          [[3, 2], 0],
          [[1, 1], 1],
          [[0, 0], 2],
        ],
      }
    ),
    textureProbe(
      '2d-size',
      ['sampler2D', 'textureSize(sampler2D,int)'],
      'uniform sampler2D s;\nivec2 probe(int lod) { return textureSize(s, lod); }',
      { textures: { s: MIPMAPPED }, inputs: [[0], [1], [2]] }
    ),
    textureProbe(
      '2d-size-unset',
      ['sampler2D', 'textureSize(sampler2D,int)'],
      'uniform sampler2D s;\nivec2 probe() { return textureSize(s, 0); }'
    ),
  ];
}

/** A source colour texture, read through the sRGB view only in an HDR 2D viewport. */
function colourProbes() {
  return [false, true].map((hdr2d) =>
    textureProbe(
      `2d-source-color${hdr2d ? '-hdr' : ''}`,
      ['sampler2D', 'source_color', 'filter_nearest', 'texture(sampler2D,vec2)'],
      'uniform sampler2D s : source_color, filter_nearest;\nvec4 probe(vec2 uv) { return texture(s, uv); }',
      { textures: { s: FLAT }, inputs: uvRows(UVS.slice(0, 3)), hdr2d }
    )
  );
}

/** A sampler passed to a function, and the elements of a sampler array. */
function passingProbes() {
  return [
    textureProbe(
      'argument',
      ['sampler2D', 'filter_nearest', 'texture(sampler2D,vec2)'],
      'uniform sampler2D s : filter_nearest;\nvec4 read(sampler2D t, vec2 uv) { return texture(t, uv); }\nvec4 probe(vec2 uv) { return read(s, uv); }',
      { textures: { s: FLAT }, inputs: uvRows(UVS.slice(0, 3)) }
    ),
    textureProbe(
      'array-elements',
      ['sampler2D', 'filter_nearest', 'texture(sampler2D,vec2)'],
      'uniform sampler2D s[3] : filter_nearest;\nvec4 probe(vec2 uv) { return texture(s[0], uv) + texture(s[1], uv) * 2.0 + texture(s[2], uv) * 4.0; }',
      { textures: { s: [FLAT, null] }, inputs: uvRows(UVS.slice(0, 2)) }
    ),
    textureProbe(
      'array-computed-index',
      ['sampler2D', 'filter_nearest', 'texture(sampler2D,vec2)'],
      'uniform sampler2D s[2] : filter_nearest;\nvec4 probe(int index) { return texture(s[index], vec2(0.375, 0.25)); }',
      { textures: { s: [FLAT, textureSpec('flat', 2, 2)] }, inputs: [[0], [1]] }
    ),
    textureProbe(
      'array-computed-argument',
      ['sampler2D', 'filter_nearest', 'texture(sampler2D,vec2)'],
      'uniform sampler2D s[2] : filter_nearest;\nvec4 read(sampler2D t) { return texture(t, vec2(0.375, 0.25)); }\nvec4 probe(int index) { return read(s[index]); }',
      { textures: { s: [FLAT, textureSpec('flat', 2, 2)] }, inputs: [[0], [1]] }
    ),
  ];
}

/** Each sampler kind, read with its native coordinate. */
function kindProbes() {
  return [
    textureProbe(
      'layers',
      ['sampler2DArray', 'filter_nearest', 'texture(sampler2DArray,vec3)'],
      'uniform sampler2DArray s : filter_nearest;\nvec4 probe(vec3 uv) { return texture(s, uv); }',
      {
        textures: { s: textureSpec('layers', 2, 2, { depth: 3 }) },
        inputs: [
          [[0.25, 0.75, 0]],
          [[0.75, 0.25, 1.4]],
          [[0.25, 0.25, 1.6]],
          [[0.25, 0.25, 7]],
          [[0.25, 0.25, 0.5]],
          [[0.25, 0.25, 1.5]],
          [[0.25, 0.25, -0.7]],
          [[0.25, 0.25, 2.5]],
        ],
      }
    ),
    textureProbe(
      'volume',
      ['sampler3D', 'filter_nearest', 'texture(sampler3D,vec3)'],
      'uniform sampler3D s : filter_nearest;\nvec4 probe(vec3 uv) { return texture(s, uv); }',
      {
        textures: { s: textureSpec('volume', 2, 2, { depth: 2 }) },
        inputs: [[[0.25, 0.75, 0.25]], [[0.75, 0.25, 0.75]]],
      }
    ),
    textureProbe(
      'cube',
      ['samplerCube', 'filter_nearest', 'texture(samplerCube,vec3)'],
      'uniform samplerCube s : filter_nearest;\nvec4 probe(vec3 direction) { return texture(s, direction); }',
      {
        textures: { s: textureSpec('cube', 2, 2) },
        inputs: [
          [[1, 0.2, -0.3]],
          [[-1, 0.4, 0.3]],
          [[0.2, 1, 0.3]],
          [[0.2, -1, -0.3]],
          [[0.3, 0.2, 1]],
          [[-0.3, 0.2, -1]],
        ],
      }
    ),
    textureProbe(
      'external',
      ['samplerExternalOES', 'filter_nearest', 'texture(samplerExternalOES,vec2)'],
      'uniform samplerExternalOES s : filter_nearest;\nvec4 probe(vec2 uv) { return texture(s, uv); }',
      { textures: { s: FLAT }, inputs: uvRows(UVS.slice(0, 3)) }
    ),
    textureProbe(
      'external-bias',
      ['samplerExternalOES', 'filter_nearest', 'texture(samplerExternalOES,vec2,float)'],
      'uniform samplerExternalOES s : filter_nearest;\nvec4 probe(vec2 uv) { return texture(s, uv, 0.5); }',
      { textures: { s: FLAT }, inputs: uvRows(UVS.slice(0, 2)) }
    ),
    textureProbe(
      'unsigned',
      ['usampler2D', 'filter_nearest', 'texture(usampler2D,vec2)'],
      'uniform usampler2D s : filter_nearest;\nuvec4 probe(vec2 uv) { return texture(s, uv); }',
      { textures: { s: FLAT }, inputs: uvRows(UVS.slice(0, 2)) }
    ),
  ];
}

/** The texture each sampler type reads in a function probe: mipmapped where both harnesses build mips. */
const SPEC_OF_KIND = {
  flat: textureSpec('flat', 4, 4, { isMipmapped: true }),
  layers: textureSpec('layers', 4, 4, { depth: 3, isMipmapped: true }),
  volume: textureSpec('volume', 4, 4, { depth: 4 }),
  cube: textureSpec('cube', 2, 2),
};

function kindOf(sampler) {
  if (sampler.endsWith('2DArray')) return 'layers';
  if (sampler.endsWith('3D')) return 'volume';
  if (sampler === 'samplerCube') return 'cube';
  return 'flat';
}

/** Three rows of each argument, by the argument's place in the call and its type. */
function argumentValues(kind, type, place) {
  if (place === 'coordinate') {
    if (type === 'vec2')
      return [
        [0.3, 0.6],
        [0.875, 0.125],
        [1.2, -0.3],
      ];
    if (kind === 'layers')
      return [
        [0.3, 0.6, 0],
        [0.875, 0.125, 1.5],
        [0.4, 0.4, 2.2],
      ];
    if (kind === 'cube')
      return [
        [1, 0.2, -0.3],
        [0.2, -1, 0.6],
        [-0.3, 0.2, -1],
      ];
    if (type === 'vec3')
      return [
        [0.3, 0.6, 0.1],
        [0.875, 0.125, 0.6],
        [0.4, 0.4, 0.9],
      ];
    if (type === 'vec4')
      return [
        [0.6, 1.2, 0.2, 2],
        [0.875, 0.125, 0.6, 1],
        [-0.2, 0.3, 0.45, -0.5],
      ];
    if (type === 'ivec2')
      return [
        [0, 0],
        [3, 1],
        [1, 2],
      ];
    return [
      [0, 0, 0],
      [3, 1, 2],
      [1, 2, 1],
    ];
  }
  if (type === 'int') return [0, 1, 0];
  if (type === 'float') return place === 'bias' ? [0, 0.7, -1] : [0, 1, 1.5];
  if (type === 'vec2')
    return place === 'dx'
      ? [
          [0.1, 0],
          [0.5, 0],
          [0, 0.02],
        ]
      : [
          [0, 0.1],
          [0, 0.3],
          [0.02, 0],
        ];
  return place === 'dx'
    ? [
        [0.1, 0, 0],
        [0.5, 0, 0],
        [0, 0.02, 0],
      ]
    : [
        [0, 0.1, 0],
        [0, 0.3, 0.1],
        [0.02, 0, 0],
      ];
}

/** The place of each argument after the sampler, by function. */
const PLACES = {
  texture: ['coordinate', 'bias'],
  textureProj: ['coordinate', 'bias'],
  textureLod: ['coordinate', 'lod'],
  textureProjLod: ['coordinate', 'lod'],
  textureGrad: ['coordinate', 'dx', 'dy'],
  textureProjGrad: ['coordinate', 'dx', 'dy'],
  texelFetch: ['coordinate', 'lod'],
  textureSize: ['lod'],
  textureGather: ['coordinate'],
  textureQueryLod: ['coordinate'],
  textureQueryLevels: [],
};

/** A probe of one function row over a texture of known texels, with a filter fit for its sampler. */
function functionProbe(row) {
  const name = row.id.slice(0, row.id.indexOf('('));
  const [sampler, ...types] = row.args;
  const kind = kindOf(sampler);
  const isFloat = !/^[iu]/.test(sampler);
  const filter = isFloat ? 'filter_linear_mipmap' : 'filter_nearest_mipmap';
  // textureGather's component is a constant expression, so it stands in the source.
  const hasComponent = name === 'textureGather' && types.length === 2;
  const passed = hasComponent ? types.slice(0, 1) : types;
  const places = PLACES[name];
  const parameters = passed.map((type, index) => `${type} a${index}`);
  const call = ['s', ...passed.map((_, index) => `a${index}`), ...(hasComponent ? ['2'] : [])].join(', ');
  const columns = passed.map((type, index) => argumentValues(kind, type, places[index]));
  const inputs =
    passed.length === 0
      ? undefined
      : columns[0].map((_, rowIndex) => columns.map((column) => column[rowIndex]));
  return textureProbe(
    `function-${row.id.replace(/[(),]/g, '-').replace(/-+$/, '')}`,
    [sampler, filter, row.id],
    `uniform ${sampler} s : ${filter};\n${row.returns} probe(${parameters.join(', ')}) { return ${name}(${call}); }`,
    { textures: { s: SPEC_OF_KIND[kind] }, inputs }
  );
}

/** Every texture function row but a cube array's and an external sampler's. */
const functionProbes = () =>
  INSTRUCTION_TABLE.filter(
    (row) =>
      row.owner === '#1829' && /^(texture|texel)\w*\(/.test(row.id) && !/CubeArray|ExternalOES/.test(row.id)
  ).map(functionProbe);

export const TEXTURE_PROBES = [
  ...filterProbes(),
  ...defaultProbes(),
  ...levelProbes(),
  ...colourProbes(),
  ...passingProbes(),
  ...kindProbes(),
  ...functionProbes(),
];
