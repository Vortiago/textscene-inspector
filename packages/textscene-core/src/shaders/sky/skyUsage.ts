import { parsedShader } from '../language/parseShader.js';
import { ShadingLanguageError } from '../language/shadingLanguageError.js';
import { everyExpressionIn } from '../language/treeWalk.js';

/** The built-ins of a sky shader that decide when Godot draws or bakes it again (`sky.cpp:70-103`). */
export interface SkyUsage {
  /** Any `LIGHTn_*`: Godot then hands the sky the scene's directional lights (`sky.cpp:1055`). */
  readonly light: boolean;
  readonly time: boolean;
  readonly position: boolean;
}

const NO_USAGE: SkyUsage = { light: false, time: false, position: false };

const LIGHT_BUILT_IN = /^LIGHT[0-3]_/;

/** What `source` reads, as Godot's compiler flags it, or nothing for a text Godot does not compile. */
export function skyUsage(source: string): SkyUsage {
  let names: Set<string>;
  try {
    names = builtInsRead(source);
  } catch (error) {
    if (error instanceof ShadingLanguageError) return NO_USAGE;
    throw error;
  }
  return {
    light: [...names].some((name) => LIGHT_BUILT_IN.test(name)),
    time: names.has('TIME'),
    position: names.has('POSITION'),
  };
}

/** Every function's, as Godot's compiler writes the code of each (`shader_compiler.cpp:768-774`). */
function builtInsRead(source: string): Set<string> {
  const names = new Set<string>();
  for (const definition of parsedShader(source).tree.functions)
    for (const expression of everyExpressionIn(definition.body))
      if (expression.kind === 'variable' && expression.builtIn) names.add(expression.name);
  return names;
}
