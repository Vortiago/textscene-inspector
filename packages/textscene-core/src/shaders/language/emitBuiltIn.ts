/**
 * The TSL node of a call of a built-in function, from a user's shader or a template's own code:
 * three/tsl's function of the same GLSL name, or a composite of TSL nodes where three has none
 * (`builtInComposites.ts`). The result is typed as the overload returns.
 */

import * as TSL from 'three/tsl';
import type { Node, TextureNode } from 'three/webgpu';
import { compositeOf } from './builtInComposites.js';
import type { InstructionRow } from './instructionTable.generated.js';

/** three's name of each GLSL function it spells otherwise. */
const TSL_NAMES: Readonly<Record<string, string>> = {
  inversesqrt: 'inverseSqrt',
  faceforward: 'faceForward',
};

/** three/tsl's function `name`, which takes any node of a GLSL type. */
function tslFunction(name: string): (...operands: Node[]) => Node {
  const operation = (TSL as Record<string, unknown>)[TSL_NAMES[name] ?? name];
  if (typeof operation !== 'function') throw new Error(`expected a three/tsl function ${name}, found none`);
  return operation as (...operands: Node[]) => Node;
}

/** The node of the call of `row`, the built-in `name`, over `operands`, a node for each argument. */
export function builtInCall(name: string, row: InstructionRow, operands: readonly Node[]): Node {
  // The first operand is the texture node of `sampler3D(texture, sampler)` (`constructed`).
  if (name === 'texture') return (operands[0] as TextureNode).sample(operands[1]!);
  if (row.returns === undefined || row.args === undefined)
    throw new Error(`expected a built-in function row with types, got ${row.id}`);
  const composite = compositeOf(name, row.args);
  const node = composite ? composite(operands, row.args) : tslFunction(name)(...operands);
  return TSL.convert(node as never, row.returns) as unknown as Node;
}
