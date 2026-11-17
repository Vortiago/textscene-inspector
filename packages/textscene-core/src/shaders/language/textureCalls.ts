import { IntType, UnsignedIntType } from 'three';
import * as TSL from 'three/tsl';
import { Node as TslNode, type Node, type NodeBuilder, type TextureNode } from 'three/webgpu';
import { compositeOf } from './builtInComposites.js';
import { CubeArrayReadNode, type CubeArrayLevel } from './cubeArray.js';
import type { InstructionRow } from './instructionTable.generated.js';
import { gathered } from './textureGather.js';
import { levelCountOf, levelOfDetail } from './textureQueries.js';
import { SizeNode } from './textureSize.js';
import { TextureBuiltNode } from './textureBuiltNode.js';
import { textureKindOf } from './types.js';

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

/** A 2D array's coordinate keeps its layer in its last lane: `vec3(uv, layer)` or `ivec3(texel, layer)`. */
function coordinateOf(sampler: string, coordinate: Node): Coordinate {
  if (textureKindOf(sampler) !== 'layers') return { uv: coordinate };
  return { uv: lanes(coordinate).xy, layer: lanes(coordinate).z };
}

/** `textureProj`'s coordinate: the lanes before the last, divided by the last (`vec3` or `vec4`). */
function projected(sampler: string, coordinate: Node, type: string): Node {
  const lane = lanes(coordinate);
  const divisor = type === 'vec3' ? lane.z : lane.w;
  const isVolume = textureKindOf(sampler) === 'volume';
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
  if (textureKindOf(row.args![0]!) === 'cubes') return cubeArrayCall(name, operands);
  return asSamplerReads(sampledCall(name, row, operands), row.returns!, texture);
}

/** A value held in a variable where the call stands: the composite reads it inside branches. */
const heldHere = (node: Node): Node => (node as unknown as { toVar(): Node }).toVar();

// A derivative inside a branch of the composite is undefined, so the call takes its gradients first.
const CUBE_ARRAY_LEVELS: Readonly<
  Record<string, (direction: Node, rest: readonly Node[]) => CubeArrayLevel>
> = {
  texture: (direction, [bias]) => ({
    kind: 'gradients',
    dx: heldHere(TSL.dFdx(direction as never) as unknown as Node),
    dy: heldHere(TSL.dFdy(direction as never) as unknown as Node),
    bias,
  }),
  textureLod: (_, [level]) => ({ kind: 'explicit', level: level! }),
  textureGrad: (_, [dx, dy]) => ({ kind: 'gradients', dx: heldHere(dx!), dy: heldHere(dy!) }),
};

function cubeArrayCall(name: string, [texture, coordinate, ...rest]: readonly Node[]): Node {
  const held = heldHere(coordinate!);
  const level = CUBE_ARRAY_LEVELS[name]!(lanes(held).xyz, rest);
  return new CubeArrayReadNode(texture as TextureNode, held, level) as unknown as Node;
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

const isInteger = (texture: TextureNode) => INTEGER_TYPES.has(texture.value.type);

/** An integer sampler over normalised or float texels reads their float bits, as Godot's driver does. */
// GL types an integer sampler apart, so the bound texture decides the read.
class IntegerReadNode extends TextureBuiltNode {
  constructor(
    private readonly read: Node,
    private readonly returns: string,
    private readonly texture: TextureNode
  ) {
    super(returns);
  }

  protected override keyOf(): string {
    return isInteger(this.texture) ? 'integer' : 'float';
  }

  protected override composite(): Node {
    if (isInteger(this.texture)) return this.read;
    const bits = this.returns.startsWith('u') ? TSL.floatBitsToUint : TSL.floatBitsToInt;
    return bits(this.read as never) as unknown as Node;
  }
}

function asSamplerReads(node: Node, returns: string, texture: TextureNode): Node {
  if (!/^[iu]vec/.test(returns)) return node;
  return new IntegerReadNode(node, returns, texture) as unknown as Node;
}
