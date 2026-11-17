import { IntType, UnsignedIntType } from 'three';
import * as TSL from 'three/tsl';
import { Node as TslNode, type Node, type NodeBuilder, type TextureNode } from 'three/webgpu';
import { compositeOf } from './builtInComposites.js';
import type { InstructionRow } from './instructionTable.generated.js';
import { gathered } from './textureGather.js';
import { levelCountOf, levelOfDetail } from './textureQueries.js';
import { SizeNode } from './textureSize.js';

/** The swizzle a node of a vector type takes, which three's types leave out. */
type Lanes = Node & Record<'x' | 'y' | 'z' | 'w' | 'xy' | 'xyz', Node>;

const lanes = (node: Node) => node as Lanes;

/** A gradient of its own type: three builds every `textureGrad` gradient as `vec2` (`TextureNode.js:699`). */
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

/** A sampling call over its texture, its coordinate, the arguments after them and its sampler type. */
type TextureCall = (
  texture: TextureNode,
  coordinate: Coordinate,
  rest: readonly Node[],
  sampler: string
) => Node;

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
  textureGather: (texture, coordinate, [channel], sampler) =>
    gathered(sampler, sampled(texture, coordinate), coordinate.uv, channel),
};

/** The calls that read no texel, over the texture and the operand after it. */
const QUERIES: Readonly<Record<string, (texture: TextureNode, operand: Node, row: InstructionRow) => Node>> =
  {
    textureSize: (texture, level, row) => new SizeNode(texture, level, row.returns!) as unknown as Node,
    textureQueryLevels: (texture) => levelCountOf(texture) as unknown as Node,
    textureQueryLod: (texture, coordinate, row) => levelOfDetail(row.args![0]!, texture, coordinate),
  };

/** Each `textureProj` call, by the call it divides the coordinate for. */
const PROJECTED: Readonly<Record<string, string>> = {
  textureProj: 'texture',
  textureProjLod: 'textureLod',
  textureProjGrad: 'textureGrad',
};

/** The texture functions the transpiler builds: a sampling call, a projected one or a query. */
export const isTextureFunction = (name: string) => name in CALLS || name in PROJECTED || name in QUERIES;

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
  const [texture, operand] = operands as [TextureNode, Node];
  const query = QUERIES[name];
  if (query) return query(texture, operand, row);
  return asSamplerReads(sampledCall(name, row, operands), row.returns!, texture);
}

function sampledCall(name: string, row: InstructionRow, operands: readonly Node[]): Node {
  const [texture, coordinate, ...rest] = operands as [TextureNode, Node, ...Node[]];
  const [sampler, coordinateType] = row.args!;
  const projectedCall = PROJECTED[name];
  if (projectedCall === undefined)
    return CALLS[name]!(texture, coordinateOf(sampler!, coordinate), rest, sampler!);
  const divided = projected(sampler!, coordinate, coordinateType!);
  return CALLS[projectedCall]!(texture, { uv: divided }, rest, sampler!);
}

const INTEGER_TYPES: ReadonlySet<number> = new Set([IntType, UnsignedIntType]);

/** An integer sampler over normalised or float texels reads their float bits, as Godot's driver does. */
function asSamplerReads(node: Node, returns: string, texture: TextureNode): Node {
  if (!/^[iu]vec/.test(returns) || INTEGER_TYPES.has(texture.value.type)) return node;
  const bits = returns.startsWith('u') ? TSL.floatBitsToUint : TSL.floatBitsToInt;
  return bits(node as never) as unknown as Node;
}
