import { IntType, UnsignedIntType } from 'three';
import * as TSL from 'three/tsl';
import {
  Node as TslNode,
  TextureSizeNode,
  type Node,
  type NodeBuilder,
  type TextureNode,
} from 'three/webgpu';
import { compositeOf } from './builtInComposites.js';
import type { InstructionRow } from './instructionTable.generated.js';

/** The swizzle a node of a vector type takes, which three's types leave out. */
type Lanes = Node & Record<'x' | 'y' | 'z' | 'w' | 'xy' | 'xyz', Node>;

const lanes = (node: Node) => node as Lanes;

/** `textureSize` with the type of the row: three's node is a `uvec2`, which drops a third lane. */
class SizeNode extends TextureSizeNode {
  constructor(textureNode: TextureNode, levelNode: Node, type: string) {
    super(textureNode, levelNode as never);
    this.nodeType = type;
  }
}

/** A gradient of its own type: three builds each `textureGrad` gradient as a `vec2` (`TextureNode.js:699`). */
class GradientNode extends TslNode {
  constructor(private readonly gradient: Node) {
    super();
  }

  override getNodeType(builder: NodeBuilder): string {
    return this.gradient.getNodeType(builder);
  }

  override build(builder: NodeBuilder): string | null {
    return this.gradient.build(builder, this.getNodeType(builder)) as string | null;
  }
}

/** The texture, the coordinate as three takes it, and the layer of a 2D array. */
interface Coordinate {
  readonly uv: Node;
  readonly layer?: Node;
}

const isLayered = (sampler: string) => sampler.endsWith('sampler2DArray');

/** A 2D array's coordinate keeps its layer in its last lane: `vec3(uv, layer)` or `ivec3(texel, layer)`. */
function coordinateOf(sampler: string, coordinate: Node): Coordinate {
  if (!isLayered(sampler)) return { uv: coordinate };
  return { uv: lanes(coordinate).xy, layer: lanes(coordinate).z };
}

/** `textureProj`'s coordinate: the lanes before the last, divided by the last (`vec3` or `vec4`). */
function projected(sampler: string, coordinate: Node, type: string): Node {
  const lane = lanes(coordinate);
  const divisor = type === 'vec3' ? lane.z : lane.w;
  const isVolume = sampler.endsWith('sampler3D');
  return TSL.div((isVolume ? lane.xyz : lane.xy) as never, divisor as never) as unknown as Node;
}

/** A sampled layer rounds half to even, as Godot's Vulkan driver does: three would truncate it. */
function sampled(texture: TextureNode, { uv, layer }: Coordinate): TextureNode {
  const node = texture.sample(uv);
  if (layer === undefined) return node;
  const rounded = compositeOf('roundEven', ['float'])!([layer], ['float']);
  return node.depth(TSL.int(rounded as never) as never) as unknown as TextureNode;
}

function loaded(texture: TextureNode, { uv, layer }: Coordinate): TextureNode {
  const node = texture.load(uv);
  return layer === undefined ? node : (node.depth(layer as never) as unknown as TextureNode);
}

/** A sampling call over its texture, its coordinate and the arguments after them. */
type TextureCall = (texture: TextureNode, coordinate: Coordinate, rest: readonly Node[]) => Node;

const CALLS: Readonly<Record<string, TextureCall>> = {
  texture: (texture, coordinate, [bias]) => {
    const node = sampled(texture, coordinate);
    return bias === undefined ? node : (node.bias(bias as never) as unknown as Node);
  },
  textureLod: (texture, coordinate, [level]) =>
    sampled(texture, coordinate).level(level as never) as unknown as Node,
  textureGrad: (texture, coordinate, [dx, dy]) => {
    const [x, y] = [dx!, dy!].map((gradient) => new GradientNode(gradient));
    return sampled(texture, coordinate).grad(x as never, y as never) as unknown as Node;
  },
  texelFetch: (texture, coordinate, [level]) =>
    loaded(texture, coordinate).level(level as never) as unknown as Node,
};

/** Each `textureProj` call, by the call it divides the coordinate for. */
const PROJECTED: Readonly<Record<string, string>> = {
  textureProj: 'texture',
  textureProjLod: 'textureLod',
  textureProjGrad: 'textureGrad',
};

/** The texture functions three samples natively, and those it divides the coordinate for. */
export const isTextureFunction = (name: string) =>
  name in CALLS || name in PROJECTED || name === 'textureSize';

/** A sampler array element at a computed index: the element nodes, and the index that picks one. */
export class SamplerChoice {
  constructor(
    readonly elements: readonly TextureNode[],
    readonly index: Node
  ) {}
}

/** The node of texture function `name` of `row`: its first operand is the sampler's texture node. */
export function textureCall(name: string, row: InstructionRow, operands: readonly Node[]): Node {
  const [sampler, ...rest] = operands;
  if (!(sampler instanceof SamplerChoice)) return elementCall(name, row, operands);
  // Each element's call, picked by the index: GLSL ES 3.0 indexes a sampler array by a constant only.
  const { elements, index } = sampler;
  const calls = elements.map((element) => elementCall(name, row, [element, ...rest]));
  return calls
    .slice(0, -1)
    .reduceRight<Node>(
      (picked, call, position) =>
        TSL.select(
          TSL.equal(index as never, TSL.int(position)),
          call as never,
          picked as never
        ) as unknown as Node,
      calls.at(-1)!
    );
}

function elementCall(name: string, row: InstructionRow, operands: readonly Node[]): Node {
  const [texture, coordinate] = operands as [TextureNode, Node];
  if (name === 'textureSize') return new SizeNode(texture, coordinate, row.returns!) as unknown as Node;
  return asSamplerReads(sampledCall(name, row, operands), row.returns!, texture);
}

function sampledCall(name: string, row: InstructionRow, operands: readonly Node[]): Node {
  const [texture, coordinate, ...rest] = operands as [TextureNode, Node, ...Node[]];
  const [sampler, coordinateType] = row.args!;
  const projectedCall = PROJECTED[name];
  if (projectedCall === undefined) return CALLS[name]!(texture, coordinateOf(sampler!, coordinate), rest);
  const divided = projected(sampler!, coordinate, coordinateType!);
  return CALLS[projectedCall]!(texture, { uv: divided }, rest);
}

const INTEGER_TYPES: ReadonlySet<number> = new Set([IntType, UnsignedIntType]);

/**
 * An `isampler` or `usampler` over a texture of normalised or float texels reads each texel's float
 * bits on Godot's Vulkan driver. three declares the sampler by the texture, so the bits are read here.
 */
function asSamplerReads(node: Node, returns: string, texture: TextureNode): Node {
  if (!/^[iu]vec/.test(returns) || INTEGER_TYPES.has(texture.value.type)) return node;
  const bits = returns.startsWith('u') ? TSL.floatBitsToUint : TSL.floatBitsToInt;
  return bits(node as never) as unknown as Node;
}
