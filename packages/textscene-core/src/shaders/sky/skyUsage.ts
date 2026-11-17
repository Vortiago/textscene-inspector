import { parsedShader, type ShaderOptions } from '../language/parseShader.js';
import { ShadingLanguageError } from '../language/shadingLanguageError.js';
import type { ShaderNode } from '../language/shaderTree.js';
import { everyExpressionIn } from '../language/treeWalk.js';
import { isSamplerType, textureKindOf, type TextureKind } from '../language/types.js';

/** What a sky shader reads that decides how Godot draws, bakes and samples it (`sky.cpp:70-103`). */
export interface SkyUsage {
  /** Any `LIGHTn_*`: Godot then hands the sky the scene's directional lights (`sky.cpp:1055`). */
  readonly light: boolean;
  /** Each sampler uniform by name. */
  readonly samplers: Readonly<Record<string, SkySampler>>;
}

export interface SkySampler {
  /** The texture the sampler reads: a Cubemap for `samplerCube`. */
  readonly kind: TextureKind;
  /** `source_color`, which decodes an sRGB texture. */
  readonly isColor: boolean;
}

const NO_USAGE: SkyUsage = { light: false, samplers: {} };

const LIGHT_BUILT_IN = /^LIGHT[0-3]_/;

/** What `source` reads, as Godot's compiler flags it, or nothing for a text Godot does not compile. */
export function skyUsage(source: string, options: ShaderOptions = {}): SkyUsage {
  let tree: ShaderNode;
  try {
    tree = parsedShader(source, options).tree;
  } catch (error) {
    if (error instanceof ShadingLanguageError) return NO_USAGE;
    throw error;
  }
  const names = builtInsRead(tree);
  return {
    light: [...names].some((name) => LIGHT_BUILT_IN.test(name)),
    samplers: samplersOf(tree),
  };
}

function samplersOf(tree: ShaderNode): Record<string, SkySampler> {
  const samplers = tree.uniforms.filter((uniform) => isSamplerType(uniform.type));
  return Object.fromEntries(
    samplers.map((uniform) => [
      uniform.name,
      { kind: textureKindOf(uniform.type), isColor: uniform.usesColor },
    ])
  );
}

/** Every function's, as Godot's compiler writes the code of each (`shader_compiler.cpp:768-774`). */
function builtInsRead(tree: ShaderNode): Set<string> {
  const names = new Set<string>();
  for (const definition of tree.functions)
    for (const expression of everyExpressionIn(definition.body))
      if (expression.kind === 'variable' && expression.builtIn) names.add(expression.name);
  return names;
}
