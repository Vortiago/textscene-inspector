import type { StructMember, StructNode } from '../language/shaderTree.js';
import { glslShapeOf } from './glslTypes.js';

/** The two packings of a block (GLSL 4.50, section 7.6.2.2). */
export type BlockPacking = 'std140' | 'std430';

/** A member at its byte offset, with the stride of each element when it is an array. */
export interface PlacedMember extends StructMember {
  readonly offset: number;
  readonly stride: number;
}

/** The members of a block or struct at their offsets, and the bytes it takes, rounded to its alignment. */
export interface Layout {
  readonly members: readonly PlacedMember[];
  readonly alignment: number;
  readonly size: number;
}

type StructOf = (type: string) => StructNode | undefined;

/** A vec4's alignment: std140 rounds an array element and a struct up to it (rule 4 and rule 9). */
const VEC4_ALIGNMENT = 16;

/** The layout of `members` packed as `packing` (rules 1 to 10). */
export function blockLayout(
  members: readonly StructMember[],
  packing: BlockPacking,
  structOf: StructOf
): Layout {
  const placed: PlacedMember[] = [];
  let end = 0;
  let alignment = packing === 'std140' ? VEC4_ALIGNMENT : 4;
  for (const member of members) {
    const { alignment: memberAlignment, stride, size } = placement(member, packing, structOf);
    const offset = roundUp(end, memberAlignment);
    placed.push({ ...member, offset, stride });
    end = offset + size;
    alignment = Math.max(alignment, memberAlignment);
  }
  return { members: placed, alignment, size: roundUp(end, alignment) };
}

interface Placement {
  readonly alignment: number;
  /** The bytes between two elements of an array, or the size of one value. */
  readonly stride: number;
  readonly size: number;
}

function placement(member: StructMember, packing: BlockPacking, structOf: StructOf): Placement {
  const one = valuePlacement(member.type, packing, structOf);
  if (member.arraySize === undefined) return one;
  const alignment = packing === 'std140' ? roundUp(one.alignment, VEC4_ALIGNMENT) : one.alignment;
  const stride = roundUp(one.size, alignment);
  return { alignment, stride, size: stride * member.arraySize };
}

function valuePlacement(type: string, packing: BlockPacking, structOf: StructOf): Placement {
  const struct = structOf(type);
  if (struct) {
    const layout = blockLayout(struct.members, packing, structOf);
    return { alignment: layout.alignment, stride: layout.size, size: layout.size };
  }
  const shape = glslShapeOf(type);
  if (!shape) throw new Error(`expected a value type or a struct in a block, got ${type}`);
  const vector = vectorPlacement(shape.rows);
  if (shape.columns === 1) return vector;
  // Rule 5: a column-major matrix is an array of its columns.
  const column = placement(
    { name: '', type: `vec${shape.rows}`, arraySize: shape.columns },
    packing,
    structOf
  );
  return { alignment: column.alignment, stride: column.size, size: column.size };
}

/** Rules 1 to 3: a scalar takes 4 bytes, a vec2 aligns to 8, and a vec3 and a vec4 to 16. */
function vectorPlacement(lanes: number): Placement {
  const size = lanes * 4;
  const alignment = lanes === 3 ? VEC4_ALIGNMENT : size;
  return { alignment, stride: size, size };
}

const roundUp = (value: number, alignment: number) => Math.ceil(value / alignment) * alignment;
