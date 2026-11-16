import { murmur3One64 } from '../../math/hashFuncs.js';
import { variant, type Variant, type VariantOf } from '../value/variant.js';
import { variantHash } from '../variantHash.js';
import { builtinMethodHash } from './builtinMethod.js';

/** `VariantCallable` (variant_callable.cpp:82): the hash of `base` now, which a later change leaves. */
export function variantCallable(base: Variant, method: string): VariantOf<'CALLABLE'> {
  const hash = murmur3One64(BigInt(builtinMethodHash(base.type, method) ?? 0), variantHash(base));
  return variant('CALLABLE', { kind: 'variant', method, base, hash });
}
