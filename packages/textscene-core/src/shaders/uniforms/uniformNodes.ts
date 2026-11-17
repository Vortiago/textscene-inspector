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

/** The `uvec4` slots a uniform takes: one per column of each element, as std140 lays it out. */
export function slotsOf(type: ValueType, arraySize: number): number {
  return Math.max(1, arraySize) * (shapeOf(type)!.columns ?? 1);
}

/** Every value uniform of a material in one buffer, as Godot's material block: WebGL 2 allows 12 blocks. */
export class MaterialBits {
  private readonly node: BitsArrayNode | undefined;
  private next = 0;

  constructor(slots: number) {
    this.node = slots > 0 ? new BitsArrayNode(slots) : undefined;
  }

  /** The uniform at the next free slots of the buffer. */
  uniform(type: ValueType, arraySize: number): UniformValue {
    const first = this.next;
    this.next += slotsOf(type, arraySize);
    if (!this.node) throw new Error(`expected a buffer with slots for ${type}, got one of none`);
    return bitsUniform(this.node, first, type, arraySize);
  }
}

/** A uniform of `type` whose slots start at `first` in `node`. A single value is an array of one. */
function bitsUniform(node: BitsArrayNode, first: number, type: ValueType, arraySize: number): UniformValue {
  const { scalar, lanes, columns = 1 } = shapeOf(type)!;
  const rows = lanes / columns;
  const slots = slotsOf(type, arraySize);
  const column = (element: Node | number, index: number): Node => {
    const slot = slotOf(element, columns, index);
    const at = typeof slot === 'number' ? slot + first : chained(slot).add(int(first) as unknown as Node);
    const bits = node.element(at as Node) as unknown as Record<string, Node>;
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
    write: (values) => {
      for (let index = 0; index < slots * SLOT_LANES.length; index++) {
        const lane = index % SLOT_LANES.length;
        const start = Math.floor(index / SLOT_LANES.length) * rows;
        node.bits[first * SLOT_LANES.length + index] =
          lane < rows ? laneBits(scalar, values[start + lane]!) : 0;
      }
    },
  };
}
