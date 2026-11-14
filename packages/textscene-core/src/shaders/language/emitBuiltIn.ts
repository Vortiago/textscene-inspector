/**
 * The TSL node of each built-in function a template's own code calls, by its GLSL name. Each is
 * the GLSL function of the same name, which three writes as it is, so the GPU computes what
 * Godot's GLSL computes. A user's shader reaches none until its row has a state on each target.
 */

import { abs, dot, fract, max, min, mix, normalize, pow, sqrt } from 'three/tsl';
import type { Node, TextureNode } from 'three/webgpu';

type BuiltIn = (operands: readonly Node[]) => Node;

/** three's types narrow each function to a few node types. Each takes any node of a GLSL type. */
const tsl = (operation: unknown) => operation as (...operands: Node[]) => Node;

const call =
  (operation: unknown): BuiltIn =>
  (operands) =>
    tsl(operation)(...operands);

export const BUILT_IN_CALLS: Readonly<Record<string, BuiltIn>> = {
  abs: call(abs),
  dot: call(dot),
  fract: call(fract),
  max: call(max),
  min: call(min),
  mix: call(mix),
  normalize: call(normalize),
  pow: call(pow),
  sqrt: call(sqrt),
  // The first operand is the texture node of `sampler3D(texture, sampler)` (`constructed`).
  texture: ([sampler, coordinates]) => (sampler as TextureNode).sample(coordinates!),
};

/** The node of the built-in call `name`, or a refusal that names it. */
export function builtInCall(name: string, operands: readonly Node[]): Node {
  const builtIn = BUILT_IN_CALLS[name];
  if (!builtIn) throw new Error(`expected a built-in function the emitter writes, got ${name}`);
  return builtIn(operands);
}
