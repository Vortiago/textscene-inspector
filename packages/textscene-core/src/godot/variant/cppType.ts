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

// The Variant names whose C++ type is spelt another way, so a bare one in a C++ row is a wrong row.
const NOT_CPP_SPELLINGS: ReadonlySet<string> = new Set(['Nil', 'int', 'float', 'AABB', 'RID']);

export function variantTypeOfCpp(cppType: string): VariantTypeName {
  const type = Object.hasOwn(CPP_ALIASES, cppType)
    ? CPP_ALIASES[cppType]
    : NOT_CPP_SPELLINGS.has(cppType)
      ? undefined
      : variantTypeOfName(cppType);
  if (type === undefined) throw new Error(`expected a Variant C++ type, got ${cppType}`);
  return type;
}
