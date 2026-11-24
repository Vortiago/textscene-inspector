import { int, notEqual, uint, uintBitsToFloat } from 'three/tsl';
import { chained, tsl } from '../language/compositeParts.js';
import { UniformArrayNode, type Node, type NodeBuilder } from 'three/webgpu';
import { CONSTRUCTORS } from '../language/emitConstant.js';
import type { ArrayValue, Value } from '../language/emitValue.js';
import type { StructMember } from '../language/shaderTree.js';
import { shapeOf, type ScalarKind, type ValueType } from '../language/types.js';
import { blockLayout } from '../template/blockLayout.js';
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

/** The slot of column `column` of element `element`, past `base`: an element has one slot per column. */
function slotOf(element: Node | number, columns: number, column: number, base: number): Node | number {
  if (typeof element === 'number') return base + element * columns + column;
  const start = columns === 1 ? element : chained(element).mul(int(columns) as unknown as Node);
  const offset = base + column;
  return offset === 0 ? start : chained(start).add(int(offset) as unknown as Node);
}

/** Bits in a `Float32Array`: three copies a `Uint32Array` as floats (r187 `WebGLUniformsGroups.js:307`). */
export class BitsArrayNode extends UniformArrayNode<'uvec4'> {
  readonly bits: Uint32Array;
  /** Written only by `setup`: the words three uploads, over the buffer of its `Float32Array`. */
  private uploaded: Uint32Array | undefined;

  /** Runs before each upload, so a writer that holds its values elsewhere writes `bits` from them. */
  beforeUpload: (() => void) | null = null;

  constructor(slots: number) {
    super(
      Array.from({ length: slots }, () => 0),
      'uvec4'
    );
    this.bits = new Uint32Array(slots * SLOT_LANES.length);
  }

  override setup(builder: NodeBuilder): Node | null | undefined {
    const output = super.setup(builder);
    const { buffer } = (this as unknown as { value: Uint32Array }).value;
    (this as unknown as { value: Float32Array }).value = new Float32Array(buffer);
    this.uploaded = new Uint32Array(buffer);
    // Again over the new buffer: the call inside `super.setup` ran before `uploaded` named it.
    this.updateBuffer();
    return output;
  }

  override updateBuffer(): void {
    this.beforeUpload?.();
    this.uploaded?.set(this.bits);
  }
}

/** The bytes of one `uvec4` slot of a `BitsArrayNode`. */
export const SLOT_BYTES = 16;
const LANE_BYTES = 4;

/** A node per uniform in one buffer at Godot's offsets (`shader_compiler.cpp:656`): WebGL 2 has 12 blocks. */
export function materialBits(uniforms: readonly StructMember[]): UniformValue[] {
  const { members: placed, size } = blockLayout(uniforms, 'std140', () => undefined);
  if (size === 0) return [];
  const node = new BitsArrayNode(size / SLOT_BYTES);
  return placed.map(({ offset, type, arraySize = 0 }) => bitsUniform(node, offset, type, arraySize));
}

/** A uniform of `type` at byte `offset` of `node`. A matrix column and an array element start a slot. */
export function bitsUniform(
  node: BitsArrayNode,
  offset: number,
  type: ValueType,
  arraySize: number
): UniformValue {
  const { scalar, lanes, columns = 1 } = shapeOf(type)!;
  const rows = lanes / columns;
  const first = Math.floor(offset / SLOT_BYTES);
  const firstLane = (offset % SLOT_BYTES) / LANE_BYTES;
  const column = (element: Node | number, index: number): Node => {
    const bits = node.element(slotOf(element, columns, index, first) as Node) as unknown as Record<
      string,
      Node
    >;
    const parts = SLOT_LANES.slice(firstLane, firstLane + rows).map((lane) =>
      LANE_OF_BITS[scalar](bits[lane]!)
    );
    return rows === 1 ? parts[0]! : CONSTRUCTORS[columns === 1 ? type : `vec${rows}`]!(...parts);
  };
  const element = (index: Node | number): Node => {
    const parts = Array.from({ length: columns }, (_, columnIndex) => column(index, columnIndex));
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
