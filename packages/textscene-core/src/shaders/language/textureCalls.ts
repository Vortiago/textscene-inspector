import { IntType, UnsignedIntType } from 'three';
import { heldInVariable } from './heldInVariable.js';
import * as TSL from 'three/tsl';
import { Node as TslNode, type Node, type NodeBuilder, type TextureNode } from 'three/webgpu';
import { CubeArrayReadNode, type CubeArrayLevel } from './cubeArray.js';
import type { InstructionRow } from './instructionTable.generated.js';
import { gathered } from './textureGather.js';
import { levelCountOf, levelOfDetail } from './textureQueries.js';
import { arrayLayerSize, cubeArraySize, isArrayLayerRead, SizeNode } from './textureSize.js';
import { TextureBuiltNode } from './textureBuiltNode.js';
import { roundedLayer } from './textureLayer.js';
import { layerScaledRead } from './layerScaledReads.js';
import { swizzles } from './compositeParts.js';
import { textureKindOf } from './types.js';
import { storedDepthOf, storedDepthRead } from './storedDepthReads.js';

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

/** The coordinate as three takes it, the layer of a 2D array, and the depth a shadow sampler compares. */
interface Coordinate {
  readonly uv: Node;
  readonly layer?: Node;
  readonly reference?: Node;
}

const isShadowSampler = (sampler: string) => sampler === 'sampler2DShadow';

/** The last lane holds a 2D array's layer, or the depth a 2D shadow sampler compares. */
function coordinateOf(sampler: string, coordinate: Node): Coordinate {
  if (isShadowSampler(sampler)) return { uv: swizzles(coordinate).xy, reference: swizzles(coordinate).z };
  if (textureKindOf(sampler) !== 'layers') return { uv: coordinate };
  return { uv: swizzles(coordinate).xy, layer: swizzles(coordinate).z };
}

const divided = (lanes: Node, divisor: Node) => TSL.div(lanes as never, divisor as never) as unknown as Node;

/** `textureProj`'s coordinate: the lanes before the last, divided by the last (`vec3` or `vec4`). */
function projected(sampler: string, coordinate: Node, type: string): Coordinate {
  const lane = swizzles(coordinate);
  const divisor = type === 'vec3' ? lane.z : lane.w;
  if (isShadowSampler(sampler)) return { uv: divided(lane.xy, divisor), reference: divided(lane.z, divisor) };
  const isVolume = textureKindOf(sampler) === 'volume';
  return { uv: divided(isVolume ? lane.xyz : lane.xy, divisor) };
}

function sampled(texture: TextureNode, { uv, layer, reference }: Coordinate): TextureNode {
  const node = texture.sample(uv);
  if (reference !== undefined)
    return node.compare(storedReference(texture, uv, reference) as never) as unknown as TextureNode;
  return layer === undefined ? node : (node.depth(roundedLayer(layer) as never) as unknown as TextureNode);
}

function storedReference(texture: TextureNode, uv: Node, reference: Node): Node {
  return storedDepthOf(texture)?.storedReference(uv, reference) ?? reference;
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
    textureSize: (texture, level, row) => {
      if (textureKindOf(row.args![0]!) === 'cubes') return cubeArraySize(texture, level);
      if (isArrayLayerRead(texture, row.returns!)) return arrayLayerSize(texture, level);
      return new SizeNode(texture, level, row.returns!) as unknown as Node;
    },
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
  const read = readerOf(name, row, rest);
  if (!(sampler instanceof SamplerChoice)) return read(sampler as TextureNode);
  // Each element's call, picked by the index: GLSL ES 3.0 indexes a sampler array by a constant only.
  const { elements, index } = sampler;
  const calls = elements.map(read);
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

/** The call over one texture, with the arguments after the sampler, which every element shares. */
function readerOf(name: string, row: InstructionRow, rest: readonly Node[]): (texture: TextureNode) => Node {
  const query = QUERIES[name];
  if (query) return (texture) => query(texture, rest[0]!, row);
  if (textureKindOf(row.args![0]!) === 'cubes') return cubeArrayReader(name, rest);
  return (texture) => asSamplerReads(sampledCall(name, row, [texture, ...rest]), row.returns!, texture);
}

// A derivative inside a branch of the composite is undefined, so the call takes its gradients first.
const CUBE_ARRAY_LEVELS: Readonly<
  Record<string, (direction: Node, rest: readonly Node[]) => CubeArrayLevel>
> = {
  texture: (direction, [bias]) => ({
    kind: 'implicit',
    dx: heldInVariable(TSL.dFdx(direction as never) as unknown as Node),
    dy: heldInVariable(TSL.dFdy(direction as never) as unknown as Node),
    bias,
  }),
  textureLod: (_, [level]) => ({ kind: 'explicit', level: level! }),
  textureGrad: (_, [dx, dy]) => ({ kind: 'gradients', dx: heldInVariable(dx!), dy: heldInVariable(dy!) }),
};

/** One coordinate and level for every element of a sampler array. */
function cubeArrayReader(
  name: string,
  [coordinate, ...rest]: readonly Node[]
): (texture: TextureNode) => Node {
  const held = heldInVariable(coordinate!);
  const level = CUBE_ARRAY_LEVELS[name]!(swizzles(held).xyz, rest);
  return (texture) => new CubeArrayReadNode(texture, held, level) as unknown as Node;
}

/** The filtered reads: a gather reads one channel of four texels, which no layer scale fits. */
const LAYER_SCALED_CALLS: ReadonlySet<string> = new Set(['texture', 'textureLod', 'textureGrad']);

function sampledCall(name: string, row: InstructionRow, operands: readonly Node[]): Node {
  const [texture, coordinate, ...rest] = operands as [TextureNode, Node, ...Node[]];
  const [sampler, coordinateType] = row.args!;
  const projectedCall = PROJECTED[name];
  const placed =
    projectedCall === undefined
      ? coordinateOf(sampler!, coordinate)
      : projected(sampler!, coordinate, coordinateType!);
  const stored = storedDepthOf(texture);
  // A stored depth filters its own texels, so the call's level, bias or gradients have nothing to pick.
  if (stored && placed.reference === undefined) return storedDepthRead(stored, placed.uv);
  const read = CALLS[projectedCall ?? name]!(texture, placed, rest, sampler!);
  return placed.layer && LAYER_SCALED_CALLS.has(name) ? layerScaledRead(texture, read, placed.layer) : read;
}

const INTEGER_TYPES: ReadonlySet<number> = new Set([IntType, UnsignedIntType]);

const isInteger = (texture: TextureNode) => INTEGER_TYPES.has(texture.value.type);

/** An integer sampler over normalised or float texels reads their float bits, as Godot's driver does. */
// GL types an integer sampler apart, so the bound texture decides the read.
class IntegerReadNode extends TextureBuiltNode<boolean> {
  constructor(
    private readonly read: Node,
    private readonly returns: string,
    private readonly texture: TextureNode
  ) {
    super(returns);
  }

  protected override keyOf(): boolean {
    return isInteger(this.texture);
  }

  protected override composite(isIntegerTexture: boolean): Node {
    if (isIntegerTexture) return this.read;
    const bits = this.returns.startsWith('u') ? TSL.floatBitsToUint : TSL.floatBitsToInt;
    return bits(this.read as never) as unknown as Node;
  }
}

function asSamplerReads(node: Node, returns: string, texture: TextureNode): Node {
  if (!/^[iu]vec/.test(returns)) return node;
  return new IntegerReadNode(node, returns, texture) as unknown as Node;
}
