import * as THREE from 'three';
import { add, bitAnd, int, ivec2, mul, shiftRight, texture } from 'three/tsl';
import type { Node, TextureNode } from 'three/webgpu';
import { tsl } from '../language/compositeParts.js';
import { CONSTRUCTORS, floatNode } from '../language/emitConstant.js';
import { element } from '../language/emitOperation.js';
import type { ArrayValue, StructValue, Value } from '../language/emitValue.js';
import type { StructMember, StructNode } from '../language/shaderTree.js';
import { vectorType, type ScalarKind } from '../language/types.js';
import { LANE_OF_BITS } from '../uniforms/uniformNodes.js';
import { blockLayout, type BlockPacking, type PlacedMember } from './blockLayout.js';
import { glslShapeOf } from './glslTypes.js';

/** The texels of one row. WebGL 2 promises 2048 texels a side, so a row stays inside it. */
export const ROW_TEXELS = 1024;

/** A texel holds 16 bytes: four 32-bit words. */
const TEXEL_WORDS = 4;

/** An index or a word offset: a constant, or an `int` node of the stage. */
type Index = Node | number;

/** A member of a block, which may be the array of no size that ends a `buffer` block. */
export type RowMember = StructMember & { readonly isRuntimeSized?: boolean };

/** A storage buffer block as an `RGBA32UI` texture, read at its packing's offsets: WebGL 2 has no buffers. */
export class RowTexture {
  readonly texture: THREE.DataTexture;
  /** The block's instance as the stage reads it: each member by name. */
  readonly value: StructValue;
  private readonly node: TextureNode;

  constructor(
    members: readonly RowMember[],
    private readonly packing: BlockPacking,
    private readonly structOf: (type: string) => StructNode | undefined
  ) {
    this.texture = new THREE.DataTexture(
      new Uint32Array(ROW_TEXELS * TEXEL_WORDS),
      ROW_TEXELS,
      1,
      THREE.RGBAIntegerFormat,
      THREE.UnsignedIntType
    );
    this.texture.internalFormat = 'RGBA32UI';
    // three binds a float texture for one never uploaded, and an integer sampler of it fails the draw.
    this.texture.needsUpdate = true;
    this.node = texture(this.texture) as unknown as TextureNode;
    this.value = this.struct(members, 0);
  }

  /** Writes the block's words from byte 0, and grows the texture to hold them. */
  write(words: Uint32Array): void {
    const rows = Math.max(1, Math.ceil(words.length / (ROW_TEXELS * TEXEL_WORDS)));
    const data = new Uint32Array(rows * ROW_TEXELS * TEXEL_WORDS);
    data.set(words);
    this.texture.image = { data, width: ROW_TEXELS, height: rows } as never;
    this.texture.needsUpdate = true;
  }

  private struct(members: readonly RowMember[], word: Index): StructValue {
    const layout = blockLayout(members, this.packing, this.structOf);
    return {
      kind: 'struct',
      members: new Map(
        layout.members.map((member, index) => [member.name, this.member(member, members[index]!, word)])
      ),
    };
  }

  private member(placed: PlacedMember, member: RowMember, base: Index): Value {
    const start = plus(base, placed.offset / 4);
    if (placed.arraySize === undefined && !member.isRuntimeSized) return this.read(placed.type, start);
    const array: ArrayValue = {
      kind: 'array',
      count: placed.arraySize ?? Number.POSITIVE_INFINITY,
      element: (index) => this.read(placed.type, plus(start, times(index, placed.stride / 4))),
    };
    return array;
  }

  /** One value of `type` whose first word is `word`. */
  private read(type: string, word: Index): Value {
    const struct = this.structOf(type);
    if (struct) return this.struct(struct.members, word);
    const shape = glslShapeOf(type);
    if (!shape || shape.scalar === 'float16')
      throw new Error(`expected a 32-bit value type in a block, got ${type}`);
    const scalar = shape.scalar;
    if (shape.columns === 1) return this.vector(scalar, shape.rows, word);
    const columnWords = this.columnStride(shape.rows) / 4;
    return squareMatrix(shape.columns, shape.rows, (column) =>
      this.vector(scalar, shape.rows, plus(word, column * columnWords))
    );
  }

  private vector(scalar: ScalarKind, lanes: number, word: Index): Node {
    const parts = Array.from({ length: lanes }, (_, lane) =>
      LANE_OF_BITS[scalar](this.word(plus(word, lane)))
    );
    return lanes === 1 ? parts[0]! : CONSTRUCTORS[vectorType(scalar, lanes)]!(...parts);
  }

  /** The bytes between two columns of a matrix, which rule 5 packs as an array of its columns. */
  private columnStride(rows: number): number {
    return blockLayout([{ name: 'column', type: `vec${rows}`, arraySize: 1 }], this.packing, this.structOf)
      .members[0]!.stride;
  }

  /** The word at `index`: lane `index & 3` of texel `index >> 2`, in rows of `ROW_TEXELS` texels. */
  private word(index: Index): Node {
    if (typeof index === 'number') {
      const texel = Math.floor(index / TEXEL_WORDS);
      const fetched = this.fetch(intNode(texel % ROW_TEXELS), intNode(Math.floor(texel / ROW_TEXELS)));
      return (fetched as unknown as Record<string, Node>)['xyzw'[index % TEXEL_WORDS]!]!;
    }
    const texel = tsl(shiftRight)(index, intNode(Math.log2(TEXEL_WORDS)));
    const x = tsl(bitAnd)(texel, intNode(ROW_TEXELS - 1));
    const y = tsl(shiftRight)(texel, intNode(Math.log2(ROW_TEXELS)));
    return element(this.fetch(x, y), tsl(bitAnd)(index, intNode(TEXEL_WORDS - 1)));
  }

  private fetch(x: Node, y: Node): Node {
    return this.node.load(tsl(ivec2)(x, y) as never).level(intNode(0) as never) as unknown as Node;
  }
}

const intNode = (value: number) => int(value) as unknown as Node;

/** `base + offset` in words, folded while both are constants. */
function plus(base: Index, offset: Index): Index {
  if (typeof base === 'number' && typeof offset === 'number') return base + offset;
  if (offset === 0) return base;
  const asNode = (index: Index) => (typeof index === 'number' ? intNode(index) : index);
  return tsl(add)(asNode(base), asNode(offset));
}

/** `index * words`, with an index of any integer type read as an `int`. */
function times(index: Index, words: number): Index {
  if (typeof index === 'number') return index * words;
  return tsl(mul)(tsl(int)(index), intNode(words));
}

/** A non-square matrix as `withSquareMatrices` holds it: the square of its larger side, zero outside it. */
function squareMatrix(columns: number, rows: number, column: (index: number) => Node): Node {
  const size = Math.max(columns, rows);
  const zero = floatNode(0);
  const padded = (index: number) => {
    if (index >= columns) return CONSTRUCTORS[`vec${size}`]!(zero);
    const read = column(index);
    return rows === size ? read : CONSTRUCTORS[`vec${size}`]!(read, ...Array<Node>(size - rows).fill(zero));
  };
  return CONSTRUCTORS[`mat${size}`]!(...Array.from({ length: size }, (_, index) => padded(index)));
}
