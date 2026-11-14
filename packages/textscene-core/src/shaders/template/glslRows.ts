/**
 * The row each operator, constructor and built-in call of a template names. Where the shading
 * language has the same signature, the node names Godot's row, so the emitter meets one row for
 * one instruction from either front end. A signature only GLSL has gets a row of its own, from
 * the section of GLSL 4.50 that defines it.
 */

import type { InstructionRow } from '../language/instructionTable.generated.js';
import { instruction, overloadInstructions, signatureInstruction } from '../language/instructions.js';
import { GLSL_FUNCTION_ROWS } from './glslBuiltIns.js';
import { canonicalType, convertsImplicitly, glslShapeOf, isOpaqueType, withScalar } from './glslTypes.js';

/** Rows only GLSL has, made once each. Written only by `glslRow`. */
const GLSL_ROWS = new Map<string, InstructionRow>();

/** The row `id` of GLSL alone, made the first time it is asked for. */
function glslRow(
  id: string,
  family: string,
  source: string,
  returns: string,
  args: readonly string[]
): InstructionRow {
  const known = GLSL_ROWS.get(id);
  if (known) return known;
  const row: InstructionRow = { id, family, source, owner: '#1830', returns, args };
  GLSL_ROWS.set(id, row);
  return row;
}

/** The row of operator `op` over `args` that gives `returns`: Godot's, or one of GLSL's section 5.9. */
export function operatorRow(op: string, args: readonly string[], returns: string): InstructionRow {
  const types = args.map(canonicalType);
  return (
    signatureInstruction(op, types) ??
    glslRow(
      `${op}(${types.join(',')})`,
      'glsl operator',
      'GLSL 4.50, section 5.9',
      canonicalType(returns),
      types
    )
  );
}

/** The row of the constructor `type(args)`: Godot's, or one of GLSL's section 5.4. */
export function constructorRow(type: string, args: readonly string[]): InstructionRow {
  const name = canonicalType(type);
  const types = args.map(canonicalType);
  return (
    signatureInstruction(name, types) ??
    glslRow(`${name}(${types.join(',')})`, 'glsl constructor', 'GLSL 4.50, section 5.4', name, types)
  );
}

/** A row Godot's table holds by id: `OP_INDEX`, `OP_CALL`, `OP_STRUCT`, `OP_EMPTY`. */
export const namedRow = (id: string): InstructionRow => instruction(id)!;

/**
 * The overloads of the built-in function `name`: GLSL's rows, then Godot's rows of other
 * signatures, then the 16-bit float form of each row over floats.
 */
export function builtInOverloads(name: string): readonly InstructionRow[] {
  const glsl = GLSL_FUNCTION_ROWS.get(name) ?? [];
  const own = new Set(glsl.map((row) => row.id));
  const godot = overloadInstructions(name).filter(
    (row) => row.family.includes('function') && !own.has(row.id)
  );
  const rows = [...glsl, ...godot];
  return [...rows, ...rows.flatMap((row) => float16Row(name, row) ?? [])];
}

/**
 * The form of a row over floats that `GL_EXT_shader_explicit_arithmetic_types` adds for
 * `float16_t`, each float type made 16-bit. Nothing for a row with a texture or with no float.
 */
function float16Row(name: string, row: InstructionRow): InstructionRow | undefined {
  const types = [row.returns ?? 'void', ...(row.args ?? [])];
  if (types.some(isOpaqueType) || !types.some((type) => glslShapeOf(type)?.scalar === 'float'))
    return undefined;
  const to16 = (type: string) => {
    const shape = glslShapeOf(type);
    return shape?.scalar === 'float' ? withScalar(shape, 'float16') : type;
  };
  const args = (row.args ?? []).map(to16);
  const source = 'GL_EXT_shader_explicit_arithmetic_types';
  return glslRow(`${name}(${args.join(',')})`, 'glsl function', source, to16(row.returns ?? 'void'), args);
}

/**
 * The overload of `rows` that a call with `args` resolves to, by section 6.1: the one whose
 * types match exactly, or else the one that needs the fewest implicit conversions. Nothing when
 * none takes the arguments.
 */
export function resolvedOverload(
  rows: readonly InstructionRow[],
  args: readonly string[]
): InstructionRow | undefined {
  let best: InstructionRow | undefined;
  let fewest = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    const params = row.args ?? [];
    if (params.length !== args.length) continue;
    if (!params.every((param, index) => convertsImplicitly(args[index]!, param))) continue;
    const conversions = params.filter(
      (param, index) => canonicalType(param) !== canonicalType(args[index]!)
    ).length;
    if (conversions < fewest) [best, fewest] = [row, conversions];
  }
  return best;
}
