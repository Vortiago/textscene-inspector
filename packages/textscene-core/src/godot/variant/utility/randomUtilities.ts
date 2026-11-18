import { GodotRandomPCG } from '../../math/randomPcg.js';
import { wrapInt32 } from '../cInteger.js';
import { NIL, variant } from '../value/variant.js';
import type { TypedFunction } from './utilityFunction.js';

// `(float)UINT32_MAX` rounds up to 2^32.
const UINT32_MAX_FLOAT = Math.fround(0xffffffff);

// `Math::rand_from_seed` (math_funcs.cpp:38): one draw of a fresh generator, and the seed it kept.
function randFromSeed(seed: bigint): bigint[] {
  return [BigInt(new GodotRandomPCG(BigInt.asUintN(64, seed)).rand()), seed];
}

export const RANDOM_UTILITIES: Readonly<Record<string, TypedFunction>> = {
  randomize: (_args, { random }) => {
    random.randomize();
    return NIL;
  },
  randi: (_args, { random }) => variant('INT', BigInt(random.draw().rand())),
  randf: (_args, { random }) =>
    variant('FLOAT', Math.fround(Math.fround(random.draw().rand()) / UINT32_MAX_FLOAT)),
  randi_range: ([from, to], { random }) =>
    variant('INT', BigInt(random.draw().randomInt(wrapInt32(from as bigint), wrapInt32(to as bigint)))),
  randf_range: ([from, to], { random }) =>
    variant('FLOAT', random.draw().randomDouble(from as number, to as number)),
  randfn: ([mean, deviation], { random }) =>
    variant('FLOAT', random.draw().randfn(mean as number, deviation as number)),
  seed: ([seed], { random }) => {
    random.seed(BigInt.asUintN(64, seed as bigint));
    return NIL;
  },
  rand_from_seed: ([seed]) => variant('PACKED_INT64_ARRAY', randFromSeed(seed as bigint)),
};
