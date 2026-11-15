import { stringToInt64 } from '../../string/string.js';
import { stringToFloat } from '../../string/strtod.js';
import { setEntry } from '../compare.js';
import { defaultValue } from '../value/defaultValue.js';
import { variant, type DictionaryEntry, type Variant, type VariantTypeName } from '../value/variant.js';
import { VARIANT_TYPE } from '../variantType.js';
import { buildFromCast } from './builders.js';
import { CONSTRUCTORS_OF_TYPE, type ConstructorSignature } from './constructorSignature.js';
import { canConvertStrict, castVariant, packedElements } from './variantCast.js';

type Arguments = readonly Variant[];

/** The registration `Variant::construct` runs for these argument types, or nothing when none takes them. */
export function constructorFor(
  type: VariantTypeName,
  argumentTypes: readonly VariantTypeName[]
): ConstructorSignature | undefined {
  return CONSTRUCTORS_OF_TYPE.get(type)?.find(
    (candidate) =>
      candidate.arguments.length === argumentTypes.length &&
      candidate.arguments.every((argumentType, index) =>
        canConvertStrict(argumentTypes[index]!, argumentType)
      )
  );
}

/** The value, or nothing where Godot reports a call error. */
export function construct(type: VariantTypeName, args: Arguments): Variant | undefined {
  const signature = constructorFor(
    type,
    args.map((arg) => arg.type)
  );
  return signature && constructWith(signature, args);
}

const isStringLike = (value: Variant) => value.type === 'STRING' || value.type === 'STRING_NAME';

function constructWith(
  { constructor, type, arguments: argumentTypes }: ConstructorSignature,
  args: Arguments
): Variant | undefined {
  const [first, second] = args;
  switch (constructor) {
    case 'VariantConstructNoArgsNil':
    case 'VariantConstructNoArgs':
    case 'VariantConstructNoArgsObject':
      return defaultValue(type);
    case 'VariantConstructorNil':
    case 'VariantConstructorNilObject':
      return first!.type === 'NIL' ? defaultValue(type) : undefined;
    case 'VariantConstructorObject':
      return first!.type === 'NIL' || first!.type === 'OBJECT' ? defaultValue(type) : undefined;
    case 'VariantConstructorFromString':
      return isStringLike(first!) ? numberFromString(type, first!.value as string) : undefined;
    case 'VariantConstructorCallableArgs':
    case 'VariantConstructorSignalArgs': {
      const hasObject = first!.type === 'NIL' || first!.type === 'OBJECT';
      return hasObject && isStringLike(second!)
        ? (variant(type, second!.value as never) as Variant)
        : undefined;
    }
    case 'VariantConstructorTypedArray':
      return typedArray(args);
    case 'VariantConstructorTypedDictionary':
      return typedDictionary(args);
    case 'VariantConstructorToArray':
      return first!.type === argumentTypes[0] ? variant('ARRAY', packedElements(first!)) : undefined;
    case 'VariantConstructorFromArray':
      return first!.type === 'ARRAY' ? castVariant(first!, type) : undefined;
    default:
      return buildFromCast(
        type,
        argumentTypes,
        args.map((arg, index) => castVariant(arg, argumentTypes[index]!))
      );
  }
}

function numberFromString(type: VariantTypeName, text: string): Variant {
  return type === 'INT' ? variant('INT', stringToInt64(text)) : variant('FLOAT', stringToFloat(text));
}

const TYPE_OF_NUMBER = new Map<number, VariantTypeName>(
  Object.entries(VARIANT_TYPE).map(([name, number]) => [number, name as VariantTypeName])
);

// `operator uint32_t()` of the INT argument, as `Variant::Type`; a number past the last type stays unnamed.
const containerType = (value: Variant) =>
  TYPE_OF_NUMBER.get(Number(BigInt.asUintN(32, value.value as bigint)));

/** The element converted as `Array::assign` and `Dictionary::assign` convert it from an untyped source. */
function convertElement(element: Variant, type: VariantTypeName | undefined): Variant | undefined {
  if (type === 'NIL') return element;
  if (type === 'OBJECT') return element.type === 'NIL' || element.type === 'OBJECT' ? element : undefined;
  if (type === undefined || !canConvertStrict(element.type, type)) return undefined;
  return element.type === type ? element : construct(type, [element]);
}

// set_typed refuses a class name on a type other than OBJECT, and the container stays untyped.
const refusesClassName = (type: VariantTypeName | undefined, className: Variant) =>
  className.value !== '' && type !== 'OBJECT';

// A failed conversion leaves the typed container empty (array.cpp:217, dictionary.cpp:430).
function typedArray([base, typeNumber, className]: Arguments): Variant | undefined {
  if (base!.type !== 'ARRAY' || typeNumber!.type !== 'INT' || !isStringLike(className!)) return undefined;
  const type = containerType(typeNumber!);
  if (refusesClassName(type, className!)) return base;
  const elements = base.value.map((element) => convertElement(element, type));
  return variant('ARRAY', elements.every(Boolean) ? (elements as Variant[]) : []);
}

function typedDictionary([base, keyType, keyClass, , valueType, valueClass]: Arguments): Variant | undefined {
  const hasTypes = keyType!.type === 'INT' && valueType!.type === 'INT';
  const hasClassNames = keyClass!.type === 'STRING_NAME' && valueClass!.type === 'STRING_NAME';
  if (base!.type !== 'DICTIONARY' || !hasTypes || !hasClassNames) return undefined;
  const [key, value] = [containerType(keyType!), containerType(valueType!)];
  if (refusesClassName(key, keyClass!) || refusesClassName(value, valueClass!)) return base;
  const entries: DictionaryEntry[] = [];
  for (const entry of base.value) {
    const [convertedKey, convertedValue] = [
      convertElement(entry.key, key),
      convertElement(entry.value, value),
    ];
    if (!convertedKey || !convertedValue) return variant('DICTIONARY', []);
    setEntry(entries, convertedKey, convertedValue);
  }
  return variant('DICTIONARY', entries);
}
