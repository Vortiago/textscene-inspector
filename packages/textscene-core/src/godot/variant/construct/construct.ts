import { stringToInt64 } from '../../string/string.js';
import { stringToFloat } from '../../string/strtod.js';
import { defaultValue } from '../value/defaultValue.js';
import { NIL, variant, type ContainerType, type Variant, type VariantTypeName } from '../value/variant.js';
import { VARIANT_TYPE } from '../variantType.js';
import { buildFromCast } from './builders.js';
import { CONSTRUCTORS_OF_TYPE, type ConstructorSignature } from './constructorSignature.js';
import { assignArray, assignDictionary } from './typedContainer.js';
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

/** What `r_ret` holds after a failed construct: null, or the null Object a constructor writes anyway. */
export function failedConstruction(type: VariantTypeName, args: Arguments): Variant {
  const signature = constructorFor(
    type,
    args.map((arg) => arg.type)
  );
  // variant_construct.h:195: VariantConstructorNilObject reports its error and still writes the null Object.
  return signature?.constructor === 'VariantConstructorNilObject' ? defaultValue(type) : NIL;
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
      if (!hasObject || !isStringLike(second!)) return undefined;
      const name = second!.value as string;
      return type === 'CALLABLE' ? variant('CALLABLE', { method: name }) : variant('SIGNAL', name);
    }
    case 'VariantConstructorTypedArray':
      return arrayFromTypedArguments(args);
    case 'VariantConstructorTypedDictionary':
      return dictionaryFromTypedArguments(args);
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

// `operator uint32_t()` of the INT argument, stored as a `Variant::Type` (array.cpp:894).
const containerType = (type: Variant, className: Variant): ContainerType => ({
  type: Number(BigInt.asIntN(32, type.value as bigint)),
  className: className.value as string,
});

// container_type_validate.h: set_typed refuses a class name on a type other than OBJECT (array.cpp:890).
const refusesClassName = ({ type, className }: ContainerType) =>
  className !== '' && type !== VARIANT_TYPE.OBJECT;

function arrayFromTypedArguments([base, typeNumber, className]: Arguments): Variant | undefined {
  if (base!.type !== 'ARRAY' || typeNumber!.type !== 'INT' || !isStringLike(className!)) return undefined;
  const elementType = containerType(typeNumber!, className!);
  if (refusesClassName(elementType)) return variant('ARRAY', [...base.value]);
  return assignArray(base, elementType);
}

function dictionaryFromTypedArguments([base, keyType, keyClass, , valueType, valueClass]: Arguments):
  Variant | undefined {
  const hasTypes = keyType!.type === 'INT' && valueType!.type === 'INT';
  const hasClassNames = keyClass!.type === 'STRING_NAME' && valueClass!.type === 'STRING_NAME';
  if (base!.type !== 'DICTIONARY' || !hasTypes || !hasClassNames) return undefined;
  const [key, value] = [containerType(keyType!, keyClass!), containerType(valueType!, valueClass!)];
  if (refusesClassName(key) || refusesClassName(value)) return variant('DICTIONARY', [...base.value]);
  return assignDictionary(base, key, value);
}
