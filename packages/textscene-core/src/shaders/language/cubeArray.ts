import { LinearFilter, LinearMipmapLinearFilter, NearestMipmapLinearFilter, type Texture } from 'three';
import * as TSL from 'three/tsl';
import type { Node, NodeBuilder, TextureNode } from 'three/webgpu';
import { lastLevelOf } from '../uniforms/textureLevels.js';
import { swizzles, untyped, type Swizzles } from './compositeParts.js';
import { cubeFaceOf, directionOf, footprintOf, type CubeFace } from './cubeFaces.js';
import { cubeLevelOf, lastLevelNodeOf } from './textureQueries.js';
import { TextureBuiltNode } from './textureBuiltNode.js';
import { roundedLayer } from './textureLayer.js';
import { SizeNode } from './textureSize.js';

/** How a call picks its level: from a level, or from the direction's gradients with a bias. */
export type CubeArrayLevel =
  | { readonly kind: 'explicit'; readonly level: Node }
  | {
      readonly kind: 'gradients';
      readonly dx: Node;
      readonly dy: Node;
      readonly bias?: Node;
      /** Whether the call takes its gradients from the screen, which only the fragment stage has. */
      readonly isImplicit?: boolean;
    };

const BLENDED_LEVELS: ReadonlySet<number> = new Set([LinearMipmapLinearFilter, NearestMipmapLinearFilter]);

/** The filter facts the program is built from. Godot gives minification and magnification one filter. */
interface Filter {
  readonly isLinear: boolean;
  readonly blendsLevels: boolean;
}

const filterOf = (texture: Texture): Filter => ({
  isLinear: texture.magFilter === LinearFilter,
  blendsLevels: BLENDED_LEVELS.has(texture.minFilter) && lastLevelOf(texture) > 0,
});

/** The size of level `level` of the 2D array: its face size, then its layers. */
const arraySizeOf = (textureNode: TextureNode, level: Node): Swizzles =>
  swizzles(new SizeNode(textureNode, untyped(level), 'ivec3'));

/** `a + (b - a) * w`, as Mesa's `lp_build_lerp`: equal texels blend to themselves, as `mix` may not. */
const lerp = (a: Node, b: Node, w: Node): Node =>
  TSL.add(untyped(a), TSL.mul(TSL.sub(untyped(b), untyped(a)), untyped(w))) as unknown as Node;

/** One texel of level `level` of cube `cube`, on the face that `face` names. */
function fetched(textureNode: TextureNode, face: CubeFace, cube: Node, level: Node, texel: Node): Node {
  const layer = TSL.add(TSL.mul(untyped(cube), 6), untyped(face.index));
  return textureNode.load(untyped(texel)).depth(untyped(layer)).level(untyped(level)) as unknown as Node;
}

/** A face of `size` texels, as an `ivec2` and a `vec2`. */
interface FaceSize {
  readonly texels: Swizzles;
  readonly size: Node;
}

/** The texel under `st` on `face`, clamped into the face. */
function texelOf(face: CubeFace, { texels, size }: FaceSize): Node {
  const texel = TSL.ivec2(untyped(TSL.floor(TSL.mul(untyped(face.st), untyped(size)))));
  const last = TSL.sub(untyped(texels), 1);
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
function cornerBlend(taps: readonly Tap[], weight: Swizzles): Node {
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
function levelRead(
  textureNode: TextureNode,
  face: CubeFace,
  cube: Node,
  level: Node,
  isLinear: boolean
): Node {
  const texels = swizzles(arraySizeOf(textureNode, level).xy);
  const faceSize: FaceSize = { texels, size: TSL.vec2(untyped(texels)) as unknown as Node };
  if (!isLinear) return fetched(textureNode, face, cube, level, texelOf(face, faceSize));
  const { corner, weight, centre } = footprintOf(face, faceSize.size);
  const tap = (s: number, t: number): Tap => {
    const index = swizzles(TSL.ivec2(TSL.add(untyped(corner), TSL.vec2(s, t))));
    const folded = cubeFaceOf(directionOf(face, centre(s, t)));
    return {
      texel: fetched(textureNode, folded, cube, level, texelOf(folded, faceSize)),
      isCorner: TSL.and(fallsOff(index.x, texels.x), fallsOff(index.y, texels.y)) as unknown as Node,
    };
  };
  const taps = [tap(0, 0), tap(1, 0), tap(0, 1), tap(1, 1)];
  const weights = swizzles(weight);
  const blended = lerp(
    lerp(taps[0]!.texel, taps[1]!.texel, weights.x),
    lerp(taps[2]!.texel, taps[3]!.texel, weights.x),
    weights.y
  );
  const isAtCorner = taps.reduce<unknown>(
    (any, each) => TSL.or(untyped(any), untyped(each.isCorner)),
    TSL.bool(false)
  );
  return TSL.select(
    untyped(isAtCorner),
    untyped(cornerBlend(taps, weights)),
    untyped(blended)
  ) as unknown as Node;
}

function unclampedLevel(
  face: CubeFace,
  levelZero: Swizzles,
  direction: Node,
  choice: CubeArrayLevel,
  stage: string
): Node {
  if (choice.kind === 'explicit') return choice.level;
  // An implicit level outside the fragment stage is level 0, as three reads it, and has no derivative.
  if (choice.isImplicit && stage !== 'fragment') return TSL.float(0) as unknown as Node;
  const size = TSL.vec2(untyped(levelZero.xy)) as unknown as Node;
  const level = cubeLevelOf(face, size, direction, [choice.dx, choice.dy]);
  return choice.bias === undefined
    ? level
    : (TSL.add(untyped(level), untyped(choice.bias)) as unknown as Node);
}

/** A cube array call, built from the texture bound when three builds the shader, which names the filter. */
export class CubeArrayReadNode extends TextureBuiltNode<Filter> {
  constructor(
    private readonly textureNode: TextureNode,
    private readonly coordinate: Node,
    private readonly choice: CubeArrayLevel
  ) {
    super('vec4');
  }

  protected override factsOf(): Filter {
    return filterOf(this.textureNode.value);
  }

  // The face variables come before any `select`: a `toVar` joins whichever stack three builds then.
  protected override composite({ isLinear, blendsLevels }: Filter, builder: NodeBuilder): Node {
    const { xyz: direction, w: layer } = swizzles(this.coordinate);
    const face = cubeFaceOf(direction);
    const levelZero = arraySizeOf(this.textureNode, TSL.int(0) as unknown as Node);
    // A 2D array of fewer than six layers holds no whole cube, and `clamp` with min above max is undefined.
    const lastCube = TSL.max(TSL.sub(TSL.div(untyped(levelZero.z), 6), 1), 0);
    const cube = TSL.clamp(untyped(roundedLayer(layer)), 0, lastCube) as unknown as Node;
    const lastLevel = lastLevelNodeOf(this.textureNode);
    const { shaderStage } = builder as unknown as { shaderStage: string };
    const unclamped = unclampedLevel(face, levelZero, direction, this.choice, shaderStage);
    const level = TSL.clamp(untyped(unclamped), 0, untyped(lastLevel)) as unknown as Node;
    const read = (at: unknown) => untyped(levelRead(this.textureNode, face, cube, untyped(at), isLinear));
    if (!blendsLevels) return read(TSL.int(TSL.sub(TSL.ceil(TSL.add(untyped(level), 0.5)), 1)));
    const lower = TSL.int(TSL.floor(untyped(level)));
    const upper = TSL.min(untyped(TSL.add(lower, 1)), untyped(TSL.int(untyped(lastLevel))));
    return lerp(read(lower), read(upper), TSL.fract(untyped(level)) as unknown as Node);
  }
}
