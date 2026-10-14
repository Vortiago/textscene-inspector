/**
 * Runs a GLSL function of floats in JS, so a test reads the number a shader term gives. Only scalar
 * arithmetic, `float` locals and the built-ins below translate. Anything else throws.
 */

import { functionBody } from './glslSource';

/** GLSL's scalar built-ins, as JS functions. */
export const GLSL_BUILT_INS = {
  abs: Math.abs,
  exp: Math.exp,
  exp2: (x: number) => 2 ** x,
  log: Math.log,
  max: Math.max,
  min: Math.min,
  pow: Math.pow,
  sqrt: Math.sqrt,
  trunc: Math.trunc,
  clamp: (x: number, low: number, high: number) => Math.min(Math.max(x, low), high),
  mix: (a: number, b: number, t: number) => a + (b - a) * t,
  smoothstep: (edge0: number, edge1: number, x: number) => {
    const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
    return t * t * (3 - 2 * t);
  },
};

/** The function `float <name>( float a, … )` of `source`, as a JS function of the same arguments. */
export function scalarGlslFunction(source: string, name: string): (...args: number[]) => number {
  const declaration = new RegExp(`float ${name}\\(([^)]*)\\)`).exec(source);
  if (!declaration) throw new Error(`expected a float function ${name}, found none`);
  const parameters = declaration[1]!.split(',').map((parameter) => {
    const scalar = /^\s*float\s+(\w+)\s*$/.exec(parameter);
    if (!scalar) throw new Error(`expected a float parameter of ${name}, got "${parameter.trim()}"`);
    return scalar[1]!;
  });
  const body = functionBody(source, `float ${name}`).replace(/\bfloat\s+/g, 'let ');
  const run = new Function(...Object.keys(GLSL_BUILT_INS), ...parameters, body) as (
    ...args: unknown[]
  ) => number;
  return (...args) => run(...Object.values(GLSL_BUILT_INS), ...args);
}
