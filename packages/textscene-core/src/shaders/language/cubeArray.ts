import { LinearFilter, LinearMipmapLinearFilter, NearestMipmapLinearFilter, type Texture } from 'three';
import * as TSL from 'three/tsl';
import type { Node, TextureNode } from 'three/webgpu';
import { compositeOf } from './builtInComposites.js';
import { untyped } from './compositeParts.js';
import { cubeFaceOf, directionOf, type CubeFace } from './cubeFaces.js';
import { cubeLevelOf, lastLevelNodeOf } from './textureQueries.js';
import { TextureBuiltNode } from './textureBuiltNode.js';
import { SizeNode } from './textureSize.js';

type Lanes = Node & Record<'x' | 'y' | 'z' | 'xy' | 'xyz' | 'w', Node>;

const lanes = (node: Node) => node as Lanes;

/** How a call picks its level: from a level, or from the direction's gradients with a bias. */
export type CubeArrayLevel =
  | { readonly kind: 'explicit'; readonly level: Node }
  | { readonly kind: 'gradients'; readonly dx: Node; readonly dy: Node; readonly bias?: Node };

const BLENDED_LEVELS: ReadonlySet<number> = new Set([LinearMipmapLinearFilter, NearestMipmapLinearFilter]);

/** The filter of the bound texture: Godot gives minification and magnification one filter. */
const isLinear = (texture: Texture) => texture.magFilter === LinearFilter;

/** The face size of level `level`: the first two lanes of the 2D array's size, whose third is its layers. */
const faceSizeOf = (textureNode: TextureNode, level: Node): Node =>
  lanes(new SizeNode(textureNode, untyped(level), 'ivec3') as unknown as Node).xy;

/** `a + (b - a) * w`, as Mesa's `lp_build_lerp`: equal texels blend to themselves, as `mix` may not. */
const lerp = (a: Node, b: Node, w: Node): Node =>
  TSL.add(untyped(a), TSL.mul(TSL.sub(untyped(b), untyped(a)), untyped(w))) as unknown as Node;

/** One texel of level `level` of cube `cube`, on the face that `face` names. */
function fetched(textureNode: TextureNode, face: CubeFace, cube: Node, level: Node, texel: Node): Node {
  const layer = TSL.add(TSL.mul(untyped(cube), 6), untyped(face.index));
  return textureNode.load(untyped(texel)).depth(untyped(layer)).level(untyped(level)) as unknown as Node;
}

/** The texel under `st` on `face`, clamped into the face. */
function texelOf(face: CubeFace, size: Node): Node {
  const last = TSL.sub(untyped(size), 1);
  const texel = TSL.ivec2(TSL.floor(TSL.mul(untyped(face.st), TSL.vec2(untyped(size)))));
  return TSL.clamp(untyped(texel), untyped(TSL.ivec2(0)), untyped(last)) as unknown as Node;
}

interface Tap {
  readonly texel: Node;
  /** Whether the tap falls off two edges of the face, past a corner of the cube. */
  readonly isCorner: Node;
}

/** Whether texel index `index` falls off the face of `size` texels, on either side. */
const fallsOff = (index: Node, size: Node) =>
  TSL.or(TSL.lessThan(untyped(index), 0), TSL.greaterThanEqual(untyped(index), untyped(size)));

/** Vulkan's corner: the three other texels share the corner's weight (`lp_bld_sample_soa.c:1559`). */
function cornerBlend(taps: readonly Tap[], weight: Lanes): Node {
  const [wx, wy] = [weight.x, weight.y];
  const [ux, uy] = [TSL.sub(1, untyped(wx)), TSL.sub(1, untyped(wy))];
  const weights = [
    TSL.mul(ux, uy),
    TSL.mul(untyped(wx), uy),
    TSL.mul(ux, untyped(wy)),
    TSL.mul(untyped(wx), untyped(wy)),
  ];
  const cornerWeight = taps.reduceRight<unknown>(
    (rest, tap, index) => TSL.select(untyped(tap.isCorner), untyped(weights[index]), untyped(rest)),
    TSL.float(0)
  );
  const share = TSL.mul(untyped(cornerWeight), 1 / 3);
  const shared = taps.map((tap, index) =>
    TSL.select(untyped(tap.isCorner), untyped(TSL.float(0)), untyped(TSL.add(untyped(weights[index]), share)))
  );
  return taps.reduce<unknown>((sum, tap, index) => {
    const term = TSL.mul(untyped(shared[index]), untyped(tap.texel));
    return sum === undefined ? term : TSL.add(term, untyped(sum));
  }, undefined) as Node;
}

/** A level read with the nearest texel, or with four texels blended, each folded onto its own face. */
function levelRead(textureNode: TextureNode, face: CubeFace, cube: Node, level: Node, linear: boolean): Node {
  const texels = faceSizeOf(textureNode, level);
  const size = TSL.vec2(untyped(texels));
  if (!linear) return fetched(textureNode, face, cube, level, texelOf(face, texels));
  const footprint = TSL.sub(TSL.mul(untyped(face.st), size), 0.5);
  const corner = TSL.floor(footprint);
  const weight = lanes(TSL.fract(footprint) as unknown as Node);
  const tap = (s: number, t: number): Tap => {
    const index = lanes(TSL.ivec2(TSL.add(corner, TSL.vec2(s, t))) as unknown as Node);
    const centre = TSL.div(TSL.add(corner, TSL.vec2(s + 0.5, t + 0.5)), size) as unknown as Node;
    const folded = cubeFaceOf(directionOf(face, centre));
    const sizes = lanes(texels);
    return {
      texel: fetched(textureNode, folded, cube, level, texelOf(folded, texels)),
      isCorner: TSL.and(fallsOff(index.x, sizes.x), fallsOff(index.y, sizes.y)) as unknown as Node,
    };
  };
  const taps = [tap(0, 0), tap(1, 0), tap(0, 1), tap(1, 1)];
  const blended = lerp(
    lerp(taps[0]!.texel, taps[1]!.texel, weight.x),
    lerp(taps[2]!.texel, taps[3]!.texel, weight.x),
    weight.y
  );
  const isAtCorner = taps.reduce<unknown>(
    (any, each) => TSL.or(untyped(any), untyped(each.isCorner)),
    TSL.bool(false)
  );
  return TSL.select(
    untyped(isAtCorner),
    untyped(cornerBlend(taps, weight)),
    untyped(blended)
  ) as unknown as Node;
}

function unclampedLevel(textureNode: TextureNode, direction: Node, choice: CubeArrayLevel): Node {
  if (choice.kind === 'explicit') return choice.level;
  const level = cubeLevelOf(textureNode, direction, [choice.dx, choice.dy]);
  return choice.bias === undefined
    ? level
    : (TSL.add(untyped(level), untyped(choice.bias)) as unknown as Node);
}

/** A cube array call, built from the texture bound when three builds the shader, which names the filter. */
export class CubeArrayReadNode extends TextureBuiltNode {
  constructor(
    private readonly textureNode: TextureNode,
    private readonly coordinate: Node,
    private readonly choice: CubeArrayLevel
  ) {
    super('vec4');
  }

  protected override keyOf(): string {
    const { minFilter } = this.textureNode.value;
    return `${isLinear(this.textureNode.value)} ${BLENDED_LEVELS.has(minFilter)}`;
  }

  // A `toVar` here joins whichever stack three builds at the time, so the composite holds no variable.
  protected override composite(): Node {
    const texture = this.textureNode.value;
    const { xyz: direction, w: layer } = lanes(this.coordinate);
    const face = cubeFaceOf(direction);
    const cubes = TSL.div(
      lanes(new SizeNode(this.textureNode, TSL.int(0) as never, 'ivec3') as unknown as Node).z as never,
      6
    );
    const rounded = compositeOf('roundEven', ['float'])!([layer], ['float']);
    const lastCube = TSL.sub(untyped(cubes), untyped(TSL.int(1)));
    const cube = TSL.clamp(
      untyped(TSL.int(untyped(rounded))),
      untyped(TSL.int(0)),
      untyped(lastCube)
    ) as unknown as Node;
    const lastLevel = lastLevelNodeOf(this.textureNode);
    const unclamped = unclampedLevel(this.textureNode, direction, this.choice);
    const level = TSL.clamp(untyped(unclamped), 0, untyped(lastLevel)) as unknown as Node;
    const read = (at: unknown) =>
      untyped(levelRead(this.textureNode, face, cube, untyped(at), isLinear(texture)));
    if (!BLENDED_LEVELS.has(texture.minFilter))
      return read(TSL.int(TSL.sub(TSL.ceil(TSL.add(untyped(level), 0.5)), 1)));
    const lower = TSL.int(TSL.floor(untyped(level)));
    const upper = TSL.min(untyped(TSL.add(lower, 1)), untyped(TSL.int(untyped(lastLevel))));
    return lerp(read(lower), read(upper), TSL.fract(untyped(level)) as unknown as Node);
  }
}
