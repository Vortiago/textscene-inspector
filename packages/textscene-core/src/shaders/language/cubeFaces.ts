import * as TSL from 'three/tsl';
import type { Node } from 'three/webgpu';
import { untyped } from './compositeParts.js';

/** The face a cube direction picks, in the axes of Vulkan's cube face table. */
export interface CubeFace {
  /** The unit direction of the face's centre. */
  readonly axis: Node;
  readonly sAxis: Node;
  readonly tAxis: Node;
  /** The face coordinate, from 0 to 1 across the face. */
  readonly st: Node;
  /** The face's layer in a cube: +x, -x, +y, -y, +z, -z are 0 to 5. */
  readonly index: Node;
}

type Lanes = Node & Record<'x' | 'y' | 'z', Node>;

/** Vulkan's cube face selection: the major axis is x, then y, then z on a tie. */
export function cubeFaceOf(direction: Node): CubeFace {
  const d = TSL.vec3(untyped(direction)).toVar() as unknown as Lanes;
  const a = TSL.abs(untyped(d)) as unknown as Lanes;
  const isX = TSL.and(
    TSL.greaterThanEqual(untyped(a.x), untyped(a.y)),
    TSL.greaterThanEqual(untyped(a.x), untyped(a.z))
  );
  const isY = TSL.and(TSL.not(isX), TSL.greaterThanEqual(untyped(a.y), untyped(a.z)));
  const pick = (x: unknown, y: unknown, z: unknown) =>
    TSL.select(isX, untyped(x), TSL.select(isY, untyped(y), untyped(z)) as never) as unknown as Node;
  const major = pick(d.x, d.y, d.z);
  const sign = TSL.select(TSL.greaterThanEqual(untyped(major), 0), 1, -1);
  const axis = TSL.mul(untyped(pick(TSL.vec3(1, 0, 0), TSL.vec3(0, 1, 0), TSL.vec3(0, 0, 1))), sign);
  const sAxis = pick(TSL.vec3(0, 0, TSL.negate(sign)), TSL.vec3(1, 0, 0), TSL.vec3(sign, 0, 0));
  const tAxis = pick(TSL.vec3(0, -1, 0), TSL.vec3(0, 0, sign), TSL.vec3(0, -1, 0));
  const reach = TSL.abs(untyped(major));
  const faceCoordinate = TSL.div(
    TSL.vec2(TSL.dot(untyped(d), untyped(sAxis)), TSL.dot(untyped(d), untyped(tAxis))),
    reach
  );
  const st = TSL.add(TSL.mul(faceCoordinate, 0.5), 0.5) as unknown as Node;
  const isNegative = TSL.select(TSL.lessThan(untyped(major), 0), TSL.int(1), TSL.int(0));
  const index = TSL.add(untyped(pick(TSL.int(0), TSL.int(2), TSL.int(4))), isNegative) as unknown as Node;
  return { axis: axis as unknown as Node, sAxis, tAxis, st, index };
}

/** The bilinear footprint of `st` on `face` of `size` texels: its corner texel, its weights, its centres. */
export function footprintOf(face: CubeFace, size: Node) {
  const at = TSL.sub(TSL.mul(untyped(face.st), untyped(size)), 0.5);
  const corner = TSL.floor(at);
  return {
    corner: corner as unknown as Node,
    weight: TSL.fract(at) as unknown as Node,
    /** The centre of the texel `s`, `t` from the corner, in face coordinates. */
    centre: (s: number, t: number) =>
      TSL.div(TSL.add(corner, TSL.vec2(s + 0.5, t + 0.5)), untyped(size)) as unknown as Node,
  };
}

/** The direction of `st` on `face`: past an edge it folds onto the next face, as Vulkan reads it. */
export function directionOf(face: CubeFace, st: Node): Node {
  const lanes = st as unknown as Node & Record<'x' | 'y', Node>;
  const [s, t] = [lanes.x, lanes.y].map((lane) => TSL.sub(TSL.mul(untyped(lane), 2), 1));
  const excess = (lane: unknown) => TSL.max(TSL.sub(TSL.abs(untyped(lane)), 1), 0);
  const folded = TSL.sub(TSL.sub(1, excess(s)), excess(t));
  const onFace = (lane: unknown) => TSL.clamp(untyped(lane), -1, 1);
  return TSL.add(
    TSL.mul(untyped(face.axis), folded),
    TSL.mul(untyped(face.sAxis), onFace(s)),
    TSL.mul(untyped(face.tAxis), onFace(t))
  ) as unknown as Node;
}
