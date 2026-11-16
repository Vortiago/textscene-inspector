import type { VariantTypeName } from './value/variant.js';
import { variantTypeOfName } from './variantType.js';

// The C++ spellings of the extension API that are not the Variant type's own name.
const CPP_ALIASES: Readonly<Record<string, VariantTypeName>> = {
  void: 'NIL',
  int64_t: 'INT',
  double: 'FLOAT',
  Size2: 'VECTOR2',
  '::AABB': 'AABB',
  '::RID': 'RID',
};

export function variantTypeOfCpp(cppType: string): VariantTypeName {
  const type = CPP_ALIASES[cppType] ?? variantTypeOfName(cppType);
  if (type === undefined) throw new Error(`expected a Variant C++ type, got ${cppType}`);
  return type;
}
