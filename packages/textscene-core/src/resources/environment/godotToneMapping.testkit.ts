import { toneMappingEffectGlsl } from './godotToneMapping';

/** The `godotToneMapWhite` constant the curve for `mode` bakes in, read from its GLSL. */
export function bakedToneMapWhite(mode: number, white: number): number {
  const glsl = toneMappingEffectGlsl(mode, white);
  const match = /const float godotToneMapWhite = ([^;]+);/.exec(glsl);
  if (!match)
    throw new Error(`expected a godotToneMapWhite constant for mode ${mode}, got ${glsl.slice(0, 80)}`);
  return Number(match[1]);
}
