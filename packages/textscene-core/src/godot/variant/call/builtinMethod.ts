import type { VariantTypeName } from '../value/variant.js';
import { variantTypeNameOf } from '../variantType.js';
import { BUILTIN_TYPES, type BuiltinMethodRow } from './builtinTypes.generated.js';

/** Written only by `methodTables` on the first call: a scene that hashes no bound method never builds it. */
let methodTablesByType: ReadonlyMap<string, ReadonlyMap<string, BuiltinMethodRow>> | undefined;

function methodTables(): ReadonlyMap<string, ReadonlyMap<string, BuiltinMethodRow>> {
  methodTablesByType ??= new Map(
    Object.entries(BUILTIN_TYPES).map(([name, row]) => [name, new Map(row.methods.map((m) => [m[0], m]))])
  );
  return methodTablesByType;
}

/** The extension API row of `method` on `type`, or nothing where `type` has no such method. */
export function builtinMethodRow(type: VariantTypeName, method: string): BuiltinMethodRow | undefined {
  return methodTables().get(variantTypeNameOf(type))?.get(method);
}

/** `Variant::get_builtin_method_hash` (variant_call.cpp:1644), or nothing where `type` has no such method. */
export const builtinMethodHash = (type: VariantTypeName, method: string): number | undefined =>
  builtinMethodRow(type, method)?.[3];
