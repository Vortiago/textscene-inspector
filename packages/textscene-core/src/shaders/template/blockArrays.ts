import type { ArrayValue } from '../language/emitValue.js';
import { shapeOf } from '../language/types.js';
import { blockLayout } from './blockLayout.js';
import { BitsArrayNode, bitsUniform, SLOT_BYTES, type UniformValue } from '../uniforms/uniformNodes.js';
import type { Lanes } from '../uniforms/uniformLanes.js';

/** WebGL 2's smallest `MAX_UNIFORM_BLOCK_SIZE`, 16,384 bytes, in slots of 16 bytes. */
const MAX_BLOCK_SLOTS = 1024;

/** One array of a block: the values a binding writes, and where the shader reads them. */
interface PackedArray {
  readonly name: string;
  readonly type: string;
  readonly count: number;
  /** Written by a binding table, which splices each element's value in. */
  readonly array: unknown[];
  /** Written only by `seal`. */
  uniform?: UniformValue;
}

/** A block's arrays in one buffer, as Godot binds it: three gives each array a block, and WebGL 2 has 12. */
export class BlockArrays {
  private readonly arrays: PackedArray[] = [];
  /** Written only by `seal`, once the block's last array is known. */
  private node: BitsArrayNode | undefined;

  constructor(private readonly blockName: string) {}

  /** The array `name` of `count` elements of `type`, and the place a binding writes its values. */
  add(name: string, type: string, count: number): { value: ArrayValue; written: { array: unknown[] } } {
    if (this.node) throw new Error(`expected the arrays of ${this.blockName} before its buffer, got ${name}`);
    const packed: PackedArray = { name, type, count, array: new Array<unknown>(count).fill(undefined) };
    this.arrays.push(packed);
    const value: ArrayValue = {
      kind: 'array',
      count,
      element: (index) => (packed.uniform!.value as ArrayValue).element(index),
    };
    return { value, written: packed };
  }

  /** Lays the arrays out at their std140 offsets, as Godot's block declares them. */
  seal(): void {
    if (this.node || this.arrays.length === 0) return;
    const members = this.arrays.map(({ name, type, count }) => ({ name, type, arraySize: count }));
    const { members: placed, size } = blockLayout(members, 'std140', () => undefined);
    const slots = size / SLOT_BYTES;
    if (slots > MAX_BLOCK_SLOTS)
      throw new Error(
        `expected the arrays of ${this.blockName} in at most ${MAX_BLOCK_SLOTS} slots, got ${slots}`
      );
    const node = new BitsArrayNode(slots);
    this.arrays.forEach((array, index) => {
      array.uniform = bitsUniform(node, placed[index]!.offset, array.type, array.count);
    });
    node.beforeUpload = () => {
      for (const array of this.arrays) array.uniform!.write(arrayLanes(array));
    };
    this.node = node;
  }
}

/** The lanes of each element of `array`, an element no binding wrote as zeros. */
function arrayLanes({ type, array }: PackedArray): Lanes {
  const lanes = shapeOf(type)!.lanes;
  return array.flatMap((value) => fitted(valueLanes(value, lanes), lanes));
}

/** Exactly `lanes` lanes, zero past the value's own: a short element would shift every element after it. */
function fitted(values: Lanes, lanes: number): Lanes {
  if (values.length === lanes) return values;
  return Array.from({ length: lanes }, (_, lane) => values[lane] ?? 0);
}

/** A three.js value's lanes: a number, a bool, a vector, a colour, or a matrix's columns in order. */
function valueLanes(value: unknown, lanes: number): Lanes {
  if (value === undefined) return [];
  if (typeof value === 'number') return [value];
  if (typeof value === 'boolean') return [value ? 1 : 0];
  if (Array.isArray(value)) return value as number[];
  const object = value as Partial<Record<'x' | 'y' | 'z' | 'w' | 'r' | 'g' | 'b', number>> & {
    elements?: ArrayLike<number>;
  };
  if (object.elements) return Array.from(object.elements).slice(0, lanes);
  if (object.r !== undefined) return [object.r, object.g!, object.b!].slice(0, lanes);
  return [object.x ?? 0, object.y ?? 0, object.z ?? 0, object.w ?? 0].slice(0, lanes);
}
