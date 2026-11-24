import { add, dFdx, dFdy, fwidth, mul } from 'three/tsl';
import { type Composite, tsl } from './compositeParts.js';

// GLSL ES 3.0 has no coarse, fine or fma: the nearest form, listed in the guide.
const plain =
  (derivative: unknown): Composite =>
  ([x]) =>
    tsl(derivative)(x!);

const fma: Composite = ([a, b, c]) => tsl(add)(tsl(mul)(a!, b!), c!);

export const NEAREST_COMPOSITES: Readonly<Record<string, Composite>> = {
  dFdxCoarse: plain(dFdx),
  dFdxFine: plain(dFdx),
  dFdyCoarse: plain(dFdy),
  dFdyFine: plain(dFdy),
  fwidthCoarse: plain(fwidth),
  fwidthFine: plain(fwidth),
  fma,
};
