import type { InstructionRow } from '../language/instructionTable.generated.js';
import {
  BITWISE_SUBGROUP_OPERATIONS,
  OWN_VALUE_SUBGROUP_FUNCTIONS,
  SUBGROUP_OPERATIONS,
} from '../language/subgroupOperations.js';
import type { StageName } from './stages.js';

/** A built-in variable: its type, its array size, and whether a stage only reads it. */
export interface BuiltInVariable {
  readonly type: string;
  readonly arraySize?: number;
  readonly isReadOnly?: true;
  readonly isConst?: boolean;
}

const read = (type: string): BuiltInVariable => ({ type, isReadOnly: true });
const write = (type: string): BuiltInVariable => ({ type });

const SUBGROUP: Readonly<Record<string, BuiltInVariable>> = {
  gl_SubgroupSize: read('uint'),
  gl_SubgroupInvocationID: read('uint'),
  gl_SubgroupEqMask: read('uvec4'),
  gl_SubgroupGeMask: read('uvec4'),
  gl_SubgroupGtMask: read('uvec4'),
  gl_SubgroupLeMask: read('uvec4'),
  gl_SubgroupLtMask: read('uvec4'),
};

/** The `gl_*` variables of each stage. */
export const STAGE_VARIABLES: Readonly<Record<StageName, Readonly<Record<string, BuiltInVariable>>>> = {
  vertex: {
    gl_VertexIndex: read('int'),
    gl_InstanceIndex: read('int'),
    gl_BaseVertex: read('int'),
    gl_BaseInstance: read('int'),
    gl_DrawID: read('int'),
    gl_ViewIndex: read('int'),
    gl_Position: write('vec4'),
    gl_PointSize: write('float'),
    ...SUBGROUP,
  },
  fragment: {
    gl_FragCoord: read('vec4'),
    gl_FrontFacing: read('bool'),
    gl_PointCoord: read('vec2'),
    gl_SampleID: read('int'),
    gl_SamplePosition: read('vec2'),
    gl_HelperInvocation: read('bool'),
    gl_ViewIndex: read('int'),
    gl_FragDepth: write('float'),
    gl_SampleMask: { type: 'int', arraySize: 1 },
    gl_SampleMaskIn: { type: 'int', arraySize: 1, isReadOnly: true },
    ...SUBGROUP,
  },
  compute: {
    gl_NumWorkGroups: read('uvec3'),
    gl_WorkGroupID: read('uvec3'),
    gl_LocalInvocationID: read('uvec3'),
    gl_GlobalInvocationID: read('uvec3'),
    gl_LocalInvocationIndex: read('uint'),
    gl_WorkGroupSize: { type: 'uvec3', isReadOnly: true, isConst: true },
    gl_NumSubgroups: read('uint'),
    gl_SubgroupID: read('uint'),
    ...SUBGROUP,
  },
};

const SUBGROUP_TYPES = ['genF', 'genI', 'genU', 'genB'];

/** The arithmetic, vote, ballot, shuffle, clustered and quad functions of `GL_KHR_shader_subgroup`. */
function subgroupDeclarations(): string[] {
  const typesOf = (operation: string) =>
    BITWISE_SUBGROUP_OPERATIONS.includes(operation) ? ['genI', 'genU', 'genB'] : ['genF', 'genI', 'genU'];
  const ofAnyType = OWN_VALUE_SUBGROUP_FUNCTIONS.filter(
    (name) => name !== 'subgroupAll' && name !== 'subgroupAny'
  );
  const withId = new Set([
    'subgroupBroadcast',
    'subgroupShuffle',
    'subgroupShuffleXor',
    'subgroupShuffleUp',
    'subgroupShuffleDown',
    'subgroupQuadBroadcast',
  ]);
  return [
    'bool subgroupElect()',
    'bool subgroupAll(bool)',
    'bool subgroupAny(bool)',
    ...SUBGROUP_TYPES.map((type) => `bool subgroupAllEqual(${type})`),
    ...SUBGROUP_OPERATIONS.flatMap((operation) =>
      typesOf(operation).flatMap((type) => [
        `${type} subgroup${operation}(${type})`,
        `${type} subgroupInclusive${operation}(${type})`,
        `${type} subgroupExclusive${operation}(${type})`,
        `${type} subgroupClustered${operation}(${type}, uint)`,
      ])
    ),
    ...ofAnyType.flatMap((name) =>
      SUBGROUP_TYPES.map((type) => `${type} ${name}(${type}${withId.has(name) ? ', uint' : ''})`)
    ),
    'uvec4 subgroupBallot(bool)',
    'bool subgroupInverseBallot(uvec4)',
    'bool subgroupBallotBitExtract(uvec4, uint)',
    'uint subgroupBallotBitCount(uvec4)',
    'uint subgroupBallotInclusiveBitCount(uvec4)',
    'uint subgroupBallotExclusiveBitCount(uvec4)',
    'uint subgroupBallotFindLSB(uvec4)',
    'uint subgroupBallotFindMSB(uvec4)',
  ];
}

/** `g` before a type is no prefix, `i` or `u`, and `gen` one to four lanes. Each expands to its rows. */
const DECLARATIONS = [
  // Section 8.8 gives a signed count, which Godot types as the value's type through implicit conversion.
  'genI bitCount(genU)',
  'genI findLSB(genU)',
  'genI findMSB(genU)',
  // Section 8.3: `mix` that picks each lane by a boolean.
  'genF mix(genF, genF, genB)',
  'genI mix(genI, genI, genB)',
  'genU mix(genU, genU, genB)',
  'genB mix(genB, genB, genB)',
  // Section 8.12: image functions, for the image types the templates declare.
  'gvec4 imageLoad(gimage2D, ivec2)',
  'gvec4 imageLoad(gimage2DArray, ivec3)',
  'gvec4 imageLoad(gimage3D, ivec3)',
  'void imageStore(gimage2D, ivec2, gvec4)',
  'void imageStore(gimage2DArray, ivec3, gvec4)',
  'void imageStore(gimage3D, ivec3, gvec4)',
  'ivec2 imageSize(gimage2D)',
  'ivec3 imageSize(gimage2DArray)',
  'ivec3 imageSize(gimage3D)',
  'uint imageAtomicAdd(uimage2D, ivec2, uint)',
  'uint imageAtomicAdd(uimage3D, ivec3, uint)',
  'uint imageAtomicOr(uimage2D, ivec2, uint)',
  'uint imageAtomicOr(uimage3D, ivec3, uint)',
  'uint imageAtomicOr(uimage2DArray, ivec3, uint)',
  // Section 8.11: atomic memory functions.
  'uint atomicAdd(uint, uint)',
  'int atomicAdd(int, int)',
  'uint atomicOr(uint, uint)',
  'int atomicOr(int, int)',
  'uint atomicMax(uint, uint)',
  'int atomicMax(int, int)',
  'uint atomicMin(uint, uint)',
  'int atomicMin(int, int)',
  // Section 8.16: barriers.
  'void barrier()',
  'void memoryBarrier()',
  'void memoryBarrierShared()',
  'void memoryBarrierImage()',
  'void memoryBarrierBuffer()',
  'void groupMemoryBarrier()',
  ...subgroupDeclarations(),
  // GL_KHR_vulkan_glsl: subpass inputs.
  'vec4 subpassLoad(subpassInput)',
  // Section 8.9.2: the forms over shadow samplers and the offset forms the shading language has not.
  'float texture(sampler2DShadow, vec3)',
  'float texture(sampler2DShadow, vec3, float)',
  'float texture(sampler2DArrayShadow, vec4)',
  'float textureLod(sampler2DShadow, vec3, float)',
  'float textureProj(sampler2DShadow, vec4)',
  'float textureProj(sampler2DShadow, vec4, float)',
  'vec4 textureGather(sampler2DShadow, vec2, float)',
  'gvec4 textureLodOffset(gsampler2D, vec2, float, ivec2)',
  'gvec4 textureLodOffset(gsampler2DArray, vec3, float, ivec2)',
  'gvec4 textureLodOffset(gsampler3D, vec3, float, ivec3)',
  'gvec4 texelFetch(gsampler2DMS, ivec2, int)',
  'gvec4 texelFetch(gtexture2D, ivec2, int)',
  'gvec4 texelFetch(gtexture2DArray, ivec3, int)',
  'gvec4 texelFetch(gtexture3D, ivec3, int)',
  'ivec2 textureSize(gsampler2DMS)',
  'ivec2 textureSize(gtexture2D, int)',
  'ivec3 textureSize(gtexture3D, int)',
  'gvec4 textureGather(gsampler2DArray, vec3, int)',
];

const PREFIXES = ['', 'i', 'u'] as const;
const LANES = [1, 2, 3, 4];
const GEN: Readonly<Record<string, (lanes: number) => string>> = {
  genF: (lanes) => (lanes === 1 ? 'float' : `vec${lanes}`),
  genI: (lanes) => (lanes === 1 ? 'int' : `ivec${lanes}`),
  genU: (lanes) => (lanes === 1 ? 'uint' : `uvec${lanes}`),
  genB: (lanes) => (lanes === 1 ? 'bool' : `bvec${lanes}`),
};

/** The overload rows of one declaration. */
function expand(declaration: string): InstructionRow[] {
  const match = /^(\S+) (\w+)\((.*)\)$/.exec(declaration)!;
  const [, returns, name, list] = match as unknown as [string, string, string, string];
  const args = list === '' ? [] : list.split(', ');
  const words = [returns, ...args];
  const variants: string[][] = [];
  if (words.some((word) => word.startsWith('g') && !word.startsWith('gen')))
    for (const prefix of PREFIXES)
      variants.push(
        words.map((word) => (word.startsWith('g') && !word.startsWith('gen') ? prefix + word.slice(1) : word))
      );
  else if (words.some((word) => word in GEN))
    for (const lanes of LANES) variants.push(words.map((word) => GEN[word]?.(lanes) ?? word));
  else variants.push(words);
  return variants.map(([type, ...types]) => ({
    id: `${name}(${types.join(',')})`,
    family: 'glsl function',
    source: 'GLSL 4.50, section 8',
    owner: '#1830',
    returns: type!,
    args: types,
  }));
}

/** The function rows of GLSL beside the shading language's, by name. */
export const GLSL_FUNCTION_ROWS: ReadonlyMap<string, readonly InstructionRow[]> = (() => {
  const rows = new Map<string, InstructionRow[]>();
  for (const row of DECLARATIONS.flatMap(expand)) {
    const name = row.id.slice(0, row.id.indexOf('('));
    rows.set(name, [...(rows.get(name) ?? []), row]);
  }
  return rows;
})();
