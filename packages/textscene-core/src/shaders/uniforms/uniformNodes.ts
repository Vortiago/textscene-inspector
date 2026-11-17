import { int, notEqual, uint, uintBitsToFloat } from 'three/tsl';
import { chained, tsl } from '../language/compositeParts.js';
import { UniformArrayNode, type Node, type NodeBuilder } from 'three/webgpu';
import { CONSTRUCTORS } from '../language/emitConstant.js';
import type { ArrayValue, Value } from '../language/emitValue.js';
import { shapeOf, type ScalarKind, type ValueType } from '../language/types.js';
import type { Lanes } from './uniformLanes.js';

/** A uniform node of the emitted shader, which takes the lanes of `uniformLanes`. */
export interface UniformValue {
  /** The value a function reads, a node or an array of nodes. */
  readonly value: Value;
  write(lanes: Lanes): void;
}

const FLOAT_BITS = new Float32Array(1);
const UINT_BITS = new Uint32Array(FLOAT_BITS.buffer);

/** The 32 bits of a lane, as the GPU reads the lane back. */
function laneBits(scalar: ScalarKind, lane: number): number {
  if (scalar !== 'float') return lane >>> 0;
  FLOAT_BITS[0] = lane;
  return UINT_BITS[0]!;
}

/** The lane a shader reads back from its bits. */
export const LANE_OF_BITS: Readonly<Record<ScalarKind, (bits: Node) => Node>> = {
  float: (bits) => tsl(uintBitsToFloat)(bits),
  int: (bits) => tsl(int)(bits),
  uint: (bits) => bits,
  bool: (bits) => tsl(notEqual)(bits, uint(0) as unknown as Node),
};

const SLOT_LANES = ['x', 'y', 'z', 'w'] as const;

/** The slot of column `column` of element `element`: an element has one slot per column. */
function slotOf(element: Node | number, columns: number, column: number): Node | number {
  if (typeof element === 'number') return element * columns + column;
  return columns === 1
    ? element
    : chained(chained(element).mul(int(columns) as unknown as Node)).add(int(column) as unknown as Node);
}

/** Bits in a `Float32Array`: three copies a `Uint32Array` as floats (r187 `WebGLUniformsGroups.js:307`). */
class BitsArrayNode extends UniformArrayNode<'uvec4'> {
  readonly bits: Uint32Array;

  constructor(slots: number) {
    super(
      Array.from({ length: slots }, () => 0),
      'uvec4'
    );
    this.bits = new Uint32Array(slots * SLOT_LANES.length);
  }

  override setup(builder: NodeBuilder): Node | null | undefined {
    const output = super.setup(builder);
    const value = (this as unknown as { value: Uint32Array }).value;
    (this as unknown as { value: Float32Array }).value = new Float32Array(value.buffer);
    return output;
  }

  override updateBuffer(): void {
    new Uint32Array((this as unknown as { value: ArrayBufferView }).value.buffer).set(this.bits);
  }
}

const SLOT_BYTES = 16;
const LANE_BYTES = 4;

/** A value uniform's type and its array size, 0 for a single value. */
export interface UniformShape {
  readonly type: ValueType;
  readonly arraySize: number;
}

/** Godot's alignment of a single value (`shader_compiler.cpp:50`): a lane, two, or a whole slot. */
function alignmentOf(type: ValueType): number {
  const { lanes, columns } = shapeOf(type)!;
  if (columns !== undefined || lanes > 2) return SLOT_BYTES;
  return lanes * LANE_BYTES;
}

/** Godot's bytes of a uniform: its lanes, or a slot per column of each element of an array (`:633`). */
function bytesOf({ type, arraySize }: UniformShape): number {
  const { lanes, columns } = shapeOf(type)!;
  if (arraySize > 0 || columns !== undefined) return Math.max(1, arraySize) * (columns ?? 1) * SLOT_BYTES;
  return lanes * LANE_BYTES;
}

const alignedTo = (offset: number, alignment: number) => Math.ceil(offset / alignment) * alignment;

/** Each uniform's byte offset in Godot's material block, in text order (`shader_compiler.cpp:656`). */
function blockOffsets(uniforms: readonly UniformShape[]): { offsets: number[]; bytes: number } {
  let end = 0;
  const offsets = uniforms.map((uniform) => {
    const offset = alignedTo(end, uniform.arraySize > 0 ? SLOT_BYTES : alignmentOf(uniform.type));
    end = offset + bytesOf(uniform);
    return offset;
  });
  return { offsets, bytes: alignedTo(end, SLOT_BYTES) };
}

/** Every value uniform of a material in one buffer, as Godot's material block: WebGL 2 allows 12 blocks. */
export class MaterialBits {
  private readonly node: BitsArrayNode | undefined;
  private readonly offsets: readonly number[];
  private next = 0;

  constructor(uniforms: readonly UniformShape[]) {
    const { offsets, bytes } = blockOffsets(uniforms);
    this.offsets = offsets;
    this.node = bytes > 0 ? new BitsArrayNode(bytes / SLOT_BYTES) : undefined;
  }

  /** The node of the next uniform of the list the buffer was laid out for. */
  uniform({ type, arraySize }: UniformShape): UniformValue {
    const offset = this.offsets[this.next++];
    if (!this.node || offset === undefined)
      throw new Error(
        `expected a laid out uniform for ${type}, got uniform ${this.next} of ${this.offsets.length}`
      );
    return bitsUniform(this.node, offset, type, arraySize);
  }
}

/** A uniform of `type` at byte `offset` of `node`. A matrix column and an array element start a slot. */
function bitsUniform(node: BitsArrayNode, offset: number, type: ValueType, arraySize: number): UniformValue {
  const { scalar, lanes, columns = 1 } = shapeOf(type)!;
  const rows = lanes / columns;
  const first = Math.floor(offset / SLOT_BYTES);
  const firstLane = (offset % SLOT_BYTES) / LANE_BYTES;
  const shifted = (slot: Node | number): Node | number => {
    if (typeof slot === 'number') return slot + first;
    return first === 0 ? slot : chained(slot).add(int(first) as unknown as Node);
  };
  const column = (element: Node | number, index: number): Node => {
    const at = shifted(slotOf(element, columns, index));
    const bits = node.element(at as Node) as unknown as Record<string, Node>;
    const parts = SLOT_LANES.slice(firstLane, firstLane + rows).map((lane) =>
      LANE_OF_BITS[scalar](bits[lane]!)
    );
    return rows === 1 ? parts[0]! : CONSTRUCTORS[columns === 1 ? type : `vec${rows}`]!(...parts);
  };
  const element = (index: Node | number): Node => {
    const parts = Array.from({ length: columns }, (_, index_) => column(index, index_));
    return columns === 1 ? parts[0]! : CONSTRUCTORS[type]!(...parts);
  };
  const value: Value =
    arraySize > 0 ? ({ kind: 'array', count: arraySize, element } as ArrayValue) : element(0);
  const slots = Math.max(1, arraySize) * columns;
  return {
    value,
    write: (values) => {
      for (let slot = 0; slot < slots; slot++)
        for (let row = 0; row < rows; row++)
          node.bits[(first + slot) * SLOT_LANES.length + firstLane + row] = laneBits(
            scalar,
            values[slot * rows + row]!
          );
    },
  };
}
