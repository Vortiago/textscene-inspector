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

/** One `uvec4` of bits per column, as std140 lays it out. A single value is an array of one. */
export function bitsUniform(type: ValueType, arraySize: number): UniformValue {
  const { scalar, lanes, columns = 1 } = shapeOf(type)!;
  const rows = lanes / columns;
  const node = new BitsArrayNode(Math.max(1, arraySize) * columns);
  const column = (element: Node | number, index: number): Node => {
    const bits = node.element(slotOf(element, columns, index) as Node) as unknown as Record<string, Node>;
    const parts = SLOT_LANES.slice(0, rows).map((lane) => LANE_OF_BITS[scalar](bits[lane]!));
    return rows === 1 ? parts[0]! : CONSTRUCTORS[columns === 1 ? type : `vec${rows}`]!(...parts);
  };
  const element = (index: Node | number): Node => {
    const parts = Array.from({ length: columns }, (_, index_) => column(index, index_));
    return columns === 1 ? parts[0]! : CONSTRUCTORS[type]!(...parts);
  };
  const value: Value =
    arraySize > 0 ? ({ kind: 'array', count: arraySize, element } as ArrayValue) : element(0);
  return {
    value,
    write: (values) =>
      node.bits.forEach((_, index) => {
        const lane = index % SLOT_LANES.length;
        const start = Math.floor(index / SLOT_LANES.length) * rows;
        node.bits[index] = lane < rows ? laneBits(scalar, values[start + lane]!) : 0;
      }),
  };
}
