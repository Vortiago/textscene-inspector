import * as TSL from 'three/tsl';
import type { Node } from 'three/webgpu';

/** The face a cube direction picks, in the axes of Vulkan's cube face table. */
export interface CubeFace {
  /** The unit direction of the face's centre. */
  readonly axis: Node;
  readonly sAxis: Node;
  readonly tAxis: Node;
  /** The face coordinate, from 0 to 1 across the face. */
  readonly st: Node;
}

type Lanes = Node & Record<'x' | 'y' | 'z', Node>;

const tsl = (node: unknown) => node as never;

/** Vulkan's cube face selection: the major axis is x, then y, then z on a tie. */
export function cubeFaceOf(direction: Node): CubeFace {
  const d = TSL.vec3(tsl(direction)).toVar() as unknown as Lanes;
  const a = TSL.abs(tsl(d)) as unknown as Lanes;
  const isX = TSL.and(TSL.greaterThanEqual(tsl(a.x), tsl(a.y)), TSL.greaterThanEqual(tsl(a.x), tsl(a.z)));
  const isY = TSL.and(TSL.not(isX), TSL.greaterThanEqual(tsl(a.y), tsl(a.z)));
  const pick = (x: unknown, y: unknown, z: unknown) =>
    TSL.select(isX, tsl(x), TSL.select(isY, tsl(y), tsl(z)) as never) as unknown as Node;
  const major = pick(d.x, d.y, d.z);
  const sign = TSL.select(TSL.greaterThanEqual(tsl(major), 0), 1, -1);
  const axis = TSL.mul(tsl(pick(TSL.vec3(1, 0, 0), TSL.vec3(0, 1, 0), TSL.vec3(0, 0, 1))), sign);
  const sAxis = pick(TSL.vec3(0, 0, TSL.negate(sign)), TSL.vec3(1, 0, 0), TSL.vec3(sign, 0, 0));
  const tAxis = pick(TSL.vec3(0, -1, 0), TSL.vec3(0, 0, sign), TSL.vec3(0, -1, 0));
  const reach = TSL.abs(tsl(major));
  const faceCoordinate = TSL.div(TSL.vec2(TSL.dot(tsl(d), tsl(sAxis)), TSL.dot(tsl(d), tsl(tAxis))), reach);
  const st = TSL.add(TSL.mul(faceCoordinate, 0.5), 0.5) as unknown as Node;
  return { axis: axis as unknown as Node, sAxis, tAxis, st };
}

/** The direction of `st` on `face`: past an edge it folds onto the next face, as Vulkan reads it. */
export function directionOf(face: CubeFace, st: Node): Node {
  const lanes = st as unknown as Node & Record<'x' | 'y', Node>;
  const [s, t] = [lanes.x, lanes.y].map((lane) => TSL.sub(TSL.mul(tsl(lane), 2), 1));
  const excess = (lane: unknown) => TSL.max(TSL.sub(TSL.abs(tsl(lane)), 1), 0);
  const folded = TSL.sub(TSL.sub(1, excess(s)), excess(t));
  const onFace = (lane: unknown) => TSL.clamp(tsl(lane), -1, 1);
  return TSL.add(
    TSL.mul(tsl(face.axis), folded),
    TSL.mul(tsl(face.sAxis), onFace(s)),
    TSL.mul(tsl(face.tAxis), onFace(t))
  ) as unknown as Node;
}
