import * as THREE from 'three';
import { add, bitAnd, int, ivec2, mul, nodeObject, shiftRight } from 'three/tsl';
import { NodeUpdateType, TextureNode, type Node, type NodeFrame } from 'three/webgpu';
import { intNode, swizzles, tsl } from '../language/compositeParts.js';
import { CONSTRUCTORS, floatNode } from '../language/emitConstant.js';
import { element } from '../language/emitOperation.js';
import type { ArrayValue, StructValue, Value } from '../language/emitValue.js';
import type { StructMember, StructNode } from '../language/shaderTree.js';
import { vectorType, type ScalarKind } from '../language/types.js';
import { LANE_OF_BITS } from '../uniforms/uniformNodes.js';
import { blockLayout, columnStride, type BlockPacking, type PlacedMember } from './blockLayout.js';
import { glslShapeOf } from './glslTypes.js';

/** The texels of one row. WebGL 2 promises 2048 texels a side, so a row stays inside it. */
const ROW_TEXELS = 1024;

/** A texel holds 16 bytes: four 32-bit words. */
const TEXEL_WORDS = 4;

/** A word: `4 * texels + words` while each step is whole texels, so one texel takes one fetch. */
type Index = { readonly texels?: Node; readonly words: number } | { readonly dynamicWords: Node };

/** An array index: a constant, or an integer node of the stage. */
type Element = Node | number;

/** A member of a block, which may be the array of no size that ends a `buffer` block. */
export type RowMember = StructMember & { readonly isRuntimeSized?: boolean };

/** The write before a draw that every fetch of one block shares. Set only by `RowTexture.writeEachDraw`. */
interface DrawWrite {
  write?: (frame: NodeFrame) => void;
}

/** Each fetch is a clone, which keeps the class and the shared write. */
class RowsNode extends TextureNode {
  override updateType = NodeUpdateType.OBJECT;
  drawWrite: DrawWrite = {};

  override update(frame: NodeFrame): undefined {
    this.drawWrite.write?.(frame);
    return undefined;
  }

  override clone(): this {
    const node = super.clone();
    node.drawWrite = this.drawWrite;
    return node;
  }
}

/** A storage buffer block as an `RGBA32UI` texture, read at its packing's offsets: WebGL 2 has no buffers. */
export class RowTexture {
  readonly texture: THREE.DataTexture;
  /** The block's instance as the stage reads it: each member by name. */
  readonly value: StructValue;
  private readonly node: RowsNode;

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
    this.node = nodeObject(new RowsNode(this.texture)) as unknown as RowsNode;
    this.value = this.struct(members, { words: 0 });
  }

  /** Writes the block's words from byte 0, and grows the texture to hold them. */
  write(words: Uint32Array): void {
    const rows = Math.max(1, Math.ceil(words.length / (ROW_TEXELS * TEXEL_WORDS)));
    const image = this.texture.image as { data: Uint32Array; height: number };
    if (image.height === rows) image.data.fill(0, words.length).set(words);
    else {
      // three allocates a texture's storage once, so a new height takes a new texture.
      this.texture.dispose();
      const data = new Uint32Array(rows * ROW_TEXELS * TEXEL_WORDS);
      data.set(words);
      this.texture.image = { data, width: ROW_TEXELS, height: rows } as never;
    }
    this.texture.needsUpdate = true;
  }

  /** Writes each drawn object's words: the node handler owns onBeforeRender (`WebGLNodesHandler.js:455`). */
  writeEachDraw(wordsOf: (object: THREE.Object3D) => Uint32Array): void {
    let writtenFor: number | undefined;
    this.node.drawWrite.write = (frame) => {
      if (frame.renderId === writtenFor) return;
      writtenFor = frame.renderId;
      this.write(wordsOf(frame.object!));
    };
  }

  private struct(members: readonly RowMember[], word: Index): StructValue {
    // An array of no size ends the block, so one element places it with an array's alignment and stride.
    const sized = members.map((member) => (member.isRuntimeSized ? { ...member, arraySize: 1 } : member));
    const layout = blockLayout(sized, this.packing, this.structOf);
    return {
      kind: 'struct',
      members: new Map(
        layout.members.map((member, index) => [member.name, this.member(member, members[index]!, word)])
      ),
    };
  }

  private member(placed: PlacedMember, member: RowMember, base: Index): Value {
    const start = plus(base, placed.offset / 4);
    if (placed.arraySize === undefined) return this.read(placed.type, start);
    return {
      kind: 'array',
      count: member.isRuntimeSized ? Number.POSITIVE_INFINITY : placed.arraySize,
      element: (index) => this.read(placed.type, stepped(start, index, placed.stride / 4)),
    } satisfies ArrayValue;
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
    const columnWords = columnStride(shape.rows, this.packing) / 4;
    return squareMatrix(shape.columns, shape.rows, (column) =>
      this.vector(scalar, shape.rows, plus(word, column * columnWords))
    );
  }

  private vector(scalar: ScalarKind, lanes: number, word: Index): Node {
    const texel = 'words' in word ? oneTexel(word, lanes) : undefined;
    const lane = (index: number) =>
      texel
        ? swizzles(texel.fetched(this))['xyzw'[texel.lane + index]! as 'x']
        : this.word(plus(word, index));
    const parts = Array.from({ length: lanes }, (_, index) => LANE_OF_BITS[scalar](lane(index)));
    return lanes === 1 ? parts[0]! : CONSTRUCTORS[vectorType(scalar, lanes)]!(...parts);
  }

  /** The word at `index`: lane `index & 3` of texel `index >> 2`, in rows of `ROW_TEXELS` texels. */
  private word(index: Index): Node {
    if ('words' in index) {
      const lane = index.words % TEXEL_WORDS;
      return swizzles(this.texel(texelOf(index)))['xyzw'[lane]! as 'x'];
    }
    const texel = tsl(shiftRight)(index.dynamicWords, intNode(Math.log2(TEXEL_WORDS)));
    return element(this.texel(texel), tsl(bitAnd)(index.dynamicWords, intNode(TEXEL_WORDS - 1)));
  }

  /** The texel at `index`, a constant or an `int` node, in rows of `ROW_TEXELS` texels. */
  texel(index: Element): Node {
    if (typeof index === 'number')
      return this.fetch(intNode(index % ROW_TEXELS), intNode(Math.floor(index / ROW_TEXELS)));
    const x = tsl(bitAnd)(index, intNode(ROW_TEXELS - 1));
    const y = tsl(shiftRight)(index, intNode(Math.log2(ROW_TEXELS)));
    return this.fetch(x, y);
  }

  private fetch(x: Node, y: Node): Node {
    return this.node.load(tsl(ivec2)(x, y) as never).level(intNode(0) as never) as unknown as Node;
  }
}

/** `base + words`. */
function plus(base: Index, words: number): Index {
  if (words === 0) return base;
  if ('words' in base) return { ...base, words: base.words + words };
  return { dynamicWords: tsl(add)(base.dynamicWords, intNode(words)) };
}

/** `base + index * stride` in words, whole texels while the stride is. */
function stepped(base: Index, index: Element, stride: number): Index {
  if (typeof index === 'number') return plus(base, index * stride);
  const steps = tsl(int)(index);
  if ('words' in base && stride % TEXEL_WORDS === 0) {
    const texels = tsl(mul)(steps, intNode(stride / TEXEL_WORDS));
    return { words: base.words, texels: base.texels ? tsl(add)(base.texels, texels) : texels };
  }
  return { dynamicWords: tsl(add)(wordsOf(base), tsl(mul)(steps, intNode(stride))) };
}

function wordsOf(index: Index): Node {
  if (!('words' in index)) return index.dynamicWords;
  const words = intNode(index.words);
  return index.texels ? tsl(add)(tsl(mul)(index.texels, intNode(TEXEL_WORDS)), words) : words;
}

/** The texel of a word of the first form: a constant, or an `int` node. */
function texelOf(index: { readonly texels?: Node; readonly words: number }): Element {
  const constant = Math.floor(index.words / TEXEL_WORDS);
  if (!index.texels) return constant;
  return constant === 0 ? index.texels : tsl(add)(index.texels, intNode(constant));
}

/** The one texel `lanes` words from `word` lie in, fetched once, or nothing when they cross a texel. */
function oneTexel(word: { readonly texels?: Node; readonly words: number }, lanes: number) {
  const lane = word.words % TEXEL_WORDS;
  if (lane + lanes > TEXEL_WORDS) return undefined;
  let fetched: Node | undefined;
  return { lane, fetched: (rows: RowTexture) => (fetched ??= rows.texel(texelOf(word))) };
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
