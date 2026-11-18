import type { ShaderNode } from '../language/shaderTree.js';
import { everyExpressionIn } from '../language/treeWalk.js';
import { SKY_LIGHT_BUILT_IN } from '../../godot/rendering/environment/skyShader.js';
import { isSamplerType } from '../language/types.js';
import { shaderSamplers, type ShaderSampler } from '../uniforms/shaderSamplers.js';
import type { SkyFrameReads } from '../../godot/rendering/environment/skyRadianceUpdate.js';
import type { SkyPassResolution } from './skyResolutionPasses.js';

/** What a sky shader reads that decides how Godot draws, bakes and samples it (`sky.cpp:70-103`). */
export interface SkyUsage extends SkyFrameReads {
  /** Any `LIGHTn_*`: Godot then hands the sky the scene's directional lights (`sky.cpp:1055`). */
  readonly light: boolean;
  /** A uniform that is not a sampler, which gives the material a buffer: Godot's `ubo_size > 0`. */
  readonly hasBufferUniforms: boolean;
  /** Each pass whose colour the shader reads, `HALF_RES_COLOR` or `QUARTER_RES_COLOR`. */
  readonly passColors: readonly SkyPassResolution[];
  /** Each sampler uniform by name. */
  readonly samplers: Readonly<Record<string, ShaderSampler>>;
}

const NO_USAGE: SkyUsage = {
  light: false,
  time: false,
  position: false,
  hasBufferUniforms: false,
  passColors: [],
  samplers: {},
};

const PASS_COLORS = [
  { resolution: 'half', builtIn: 'HALF_RES_COLOR' },
  { resolution: 'quarter', builtIn: 'QUARTER_RES_COLOR' },
] as const;

/** What `tree` reads, as Godot's compiler flags it, or nothing for a sky that draws Godot's default sky. */
export function skyUsage(tree: ShaderNode | null): SkyUsage {
  if (tree === null) return NO_USAGE;
  const names = builtInsRead(tree);
  return {
    light: [...names].some((name) => SKY_LIGHT_BUILT_IN.test(name)),
    time: names.has('TIME'),
    position: names.has('POSITION'),
    hasBufferUniforms: tree.uniforms.some((uniform) => !isSamplerType(uniform.type)),
    passColors: PASS_COLORS.filter(({ builtIn }) => names.has(builtIn)).map(({ resolution }) => resolution),
    samplers: shaderSamplers(tree.uniforms),
  };
}

/** Every function's, as Godot's compiler writes the code of each (`shader_compiler.cpp:768-774`). */
function builtInsRead(tree: ShaderNode): Set<string> {
  const names = new Set<string>();
  for (const definition of tree.functions)
    for (const expression of everyExpressionIn(definition.body))
      if (expression.kind === 'variable' && expression.builtIn) names.add(expression.name);
  return names;
}
