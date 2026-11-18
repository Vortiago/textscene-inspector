import * as TSL from 'three/tsl';
import type { Node } from 'three/webgpu';
import { compositeOf } from './builtInComposites.js';
import { glslReturnOf } from './glslTypes.js';
import type { InstructionRow } from './instructionTable.generated.js';
import { isTextureFunction, textureCall } from './textureCalls.js';

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
  if (row.returns === undefined || row.args === undefined)
    throw new Error(`expected a built-in function row with types, got ${row.id}`);
  const node = isTextureFunction(name)
    ? textureCall(name, row, operands)
    : functionCall(name, row.args, operands);
  if (row.returns === 'void') return node; // Its last write, which the statement drops.
  return TSL.convert(node as never, glslReturnOf(row)!) as unknown as Node;
}

function functionCall(name: string, args: readonly string[], operands: readonly Node[]): Node {
  const composite = compositeOf(name, args);
  return composite ? composite(operands, args) : tslFunction(name)(...operands);
}
