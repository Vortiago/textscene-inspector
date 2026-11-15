import { variantTypeOfCpp as cpp } from '../cppType.js';
import { CONSTRUCTOR_REGISTRATIONS } from '../registrations.generated.js';
import type { VariantTypeName } from '../value/variant.js';

export type ConstructorRegistration = (typeof CONSTRUCTOR_REGISTRATIONS)[number];

export interface ConstructorSignature {
  /** The row's place in CONSTRUCTOR_REGISTRATIONS. */
  readonly index: number;
  readonly constructor: string;
  readonly type: VariantTypeName;
  readonly arguments: readonly VariantTypeName[];
}

const TYPED_DICTIONARY_ARGUMENTS: readonly VariantTypeName[] = [
  'DICTIONARY',
  'INT',
  'STRING_NAME',
  'NIL',
  'INT',
  'STRING_NAME',
  'NIL',
];

function signatureTypes(
  constructor: string,
  types: readonly string[]
): Pick<ConstructorSignature, 'type' | 'arguments'> {
  switch (constructor) {
    case 'VariantConstructNoArgsNil':
      return { type: 'NIL', arguments: [] };
    case 'VariantConstructorNil':
      return { type: 'NIL', arguments: ['NIL'] };
    case 'VariantConstructNoArgs':
      return { type: cpp(types[0]!), arguments: [] };
    case 'VariantConstructor':
      return { type: cpp(types[0]!), arguments: types.slice(1).map(cpp) };
    case 'VariantConstructorFromString':
      return { type: cpp(types[0]!), arguments: ['STRING'] };
    case 'VariantConstructNoArgsObject':
      return { type: 'OBJECT', arguments: [] };
    case 'VariantConstructorObject':
      return { type: 'OBJECT', arguments: ['OBJECT'] };
    case 'VariantConstructorNilObject':
      return { type: 'OBJECT', arguments: ['NIL'] };
    case 'VariantConstructorCallableArgs':
      return { type: 'CALLABLE', arguments: ['OBJECT', 'STRING_NAME'] };
    case 'VariantConstructorSignalArgs':
      return { type: 'SIGNAL', arguments: ['OBJECT', 'STRING_NAME'] };
    case 'VariantConstructorTypedDictionary':
      return { type: 'DICTIONARY', arguments: TYPED_DICTIONARY_ARGUMENTS };
    case 'VariantConstructorTypedArray':
      return { type: 'ARRAY', arguments: ['ARRAY', 'INT', 'STRING_NAME', 'NIL'] };
    case 'VariantConstructorToArray':
      return { type: 'ARRAY', arguments: [cpp(types[0]!)] };
    case 'VariantConstructorFromArray':
      return { type: cpp(types[0]!), arguments: ['ARRAY'] };
    default:
      throw new Error(`expected a known constructor class, got ${constructor}`);
  }
}

/** Throws on a class this does not know, so a new Godot constructor fails the build's tests. */
export function constructorSignature(
  [constructor, types]: ConstructorRegistration,
  index: number
): ConstructorSignature {
  return { index, constructor, ...signatureTypes(constructor, types) };
}

/** Each type's constructors in registration order, as `Variant::construct` tries them. */
export const CONSTRUCTORS_OF_TYPE: ReadonlyMap<VariantTypeName, readonly ConstructorSignature[]> = (() => {
  const byType = new Map<VariantTypeName, ConstructorSignature[]>();
  for (const signature of CONSTRUCTOR_REGISTRATIONS.map(constructorSignature)) {
    byType.set(signature.type, [...(byType.get(signature.type) ?? []), signature]);
  }
  return byType;
})();
