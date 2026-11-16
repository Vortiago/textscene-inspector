import type { VariantTypeName } from '../value/variant.js';
import { variantTypeNameOf } from '../variantType.js';
import { BUILTIN_TYPES, type BuiltinMethodRow } from './builtinTypes.generated.js';

const METHOD_TABLES = new Map<string, ReadonlyMap<string, BuiltinMethodRow>>(
  Object.entries(BUILTIN_TYPES).map(([name, row]) => [name, new Map(row.methods.map((m) => [m[0], m]))])
);

/** `Variant::get_builtin_method_hash` (variant_call.cpp:1644), or nothing where `type` has no such method. */
export function builtinMethodHash(type: VariantTypeName, method: string): number | undefined {
  return METHOD_TABLES.get(variantTypeNameOf(type))!.get(method)?.[3];
}
