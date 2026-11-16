/**
 * How Godot's text format spells a number (`VariantWriter::write`, `core/variant/variant_parser.cpp`),
 * for a reader that turns another serialisation into that text.
 */

import { formatReal, storedReal } from '../math/real.js';
import { cEscape, cEscapeMultiline } from '../string/escapes.js';
import { doubleChars, floatChars } from '../string/grisu2.js';
import { nodePathFromParts } from '../string/nodePathParts.js';
import { isStringLess } from '../string/stringOrder.js';
import { sortArray } from '../templates/sortArray.js';
import { isVariantLess } from './operators/evaluate.js';
import {
  MAX_RECURSION,
  type ContainerType,
  type DictionaryEntry,
  type Variant,
  type VariantOf,
} from './value/variant.js';
import { variantTypeName, variantTypeNameOf } from './variantType.js';
import {
  componentsOf,
  isStructVariant,
  MATH_LAYOUT,
  packedComponents,
  type StructVariant,
} from './value/mathLayout.js';

/** `rtos_fix` (variant_parser.cpp:1985): zero without its sign, and a float's spelling where it fits. */
export function componentLiteral(value: number): string {
  if (value === 0) return '0';
  if (!Number.isFinite(value)) return formatReal(value);
  return storedReal(value) === value ? floatChars(value) : doubleChars(value);
}

// A FLOAT keeps a `.0` unless its text holds a point or an `e`, as `inf_neg` does (variant_parser.cpp:2027).
const withFloatPoint = (text: string) => (/^-?inf$|^nan$|[.eE]/.test(text) ? text : `${text}.0`);

/** A FLOAT Variant, with `.0` appended to an integral spelling so it stays a float literal (`:2022-2030`). */
export function floatLiteral(value: number): string {
  return withFloatPoint(componentLiteral(value));
}

/** `rtos_fix` with `p_compat`, as `write_to_string` defaults to it (variant_parser.h:163). */
function compatComponent(value: number): string {
  return value === -Infinity ? 'inf_neg' : componentLiteral(value);
}

const components = (values: readonly number[]) => values.map(compatComponent).join(', ');
const ints = (values: readonly (number | bigint)[]) => values.join(', ');
const call = (name: string, body: string) => `${name}(${body})`;

// The name `Variant::get_type_name` gives a type, empty past the last one (variant.cpp:174).
const typeName = (type: number) => variantTypeName(type) ?? '';

function containerTypeName(container: ContainerType | undefined): string {
  if (!container) return 'Variant';
  return container.className || typeName(container.type);
}

function arrayText(array: VariantOf<'ARRAY'>, depth: number): string {
  const body =
    depth > MAX_RECURSION
      ? '[]'
      : `[${array.value.map((element) => written(element, depth + 1)).join(', ')}]`;
  return array.elementType ? `Array[${containerTypeName(array.elementType)}](${body})` : body;
}

function dictionaryBody(entries: readonly DictionaryEntry[], depth: number): string {
  if (depth > MAX_RECURSION || entries.length === 0) return '{}';
  const sorted = [...entries];
  sortArray(sorted, (a, b) => isStringLikeLess(a.key, b.key));
  const lines = sorted.map(({ key, value }) => `${written(key, depth + 1)}: ${written(value, depth + 1)}`);
  return `{\n${lines.join(',\n')}\n}`;
}

function dictionaryText(dictionary: VariantOf<'DICTIONARY'>, depth: number): string {
  const body = dictionaryBody(dictionary.value, depth);
  const { keyType, valueType } = dictionary;
  if (!keyType && !valueType) return body;
  return `Dictionary[${containerTypeName(keyType)}, ${containerTypeName(valueType)}](${body})`;
}

/** `StringLikeVariantOrder::compare` (variant.cpp:3409): a String and a StringName compare as texts. */
function isStringLikeLess(a: Variant, b: Variant): boolean {
  const isText = (value: Variant) => value.type === 'STRING' || value.type === 'STRING_NAME';
  if (isText(a) && isText(b)) return isStringLess(a.value as string, b.value as string);
  return isVariantLess(a, b);
}

function written(value: Variant, depth: number): string {
  if (isStructVariant(value)) return call(variantTypeNameOf(value.type), structBody(value));
  switch (value.type) {
    case 'NIL':
    case 'OBJECT':
      return 'null';
    case 'BOOL':
      return value.value ? 'true' : 'false';
    case 'INT':
      return `${value.value}`;
    case 'FLOAT':
      return withFloatPoint(compatComponent(value.value));
    case 'STRING':
      return `"${cEscapeMultiline(value.value)}"`;
    case 'STRING_NAME':
      return `&"${cEscape(value.value)}"`;
    case 'NODE_PATH':
      return call('NodePath', `"${cEscape(nodePathFromParts(value.value))}"`);
    case 'RID':
      return value.value === 0n ? 'RID()' : call('RID', `${BigInt.asIntN(64, value.value)}`);
    case 'SIGNAL':
      return 'Signal()';
    case 'CALLABLE':
      return 'Callable()';
    case 'DICTIONARY':
      return dictionaryText(value, depth);
    case 'ARRAY':
      return arrayText(value, depth);
    default:
      return call(variantTypeNameOf(value.type), packedBody(value));
  }
}

type PackedVariant = Extract<Variant, { type: `PACKED_${string}` }>;

function packedBody(value: PackedVariant): string {
  switch (value.type) {
    case 'PACKED_BYTE_ARRAY':
    case 'PACKED_INT32_ARRAY':
    case 'PACKED_INT64_ARRAY':
      return ints(value.value);
    case 'PACKED_FLOAT32_ARRAY':
    case 'PACKED_FLOAT64_ARRAY':
      return components(value.value);
    case 'PACKED_STRING_ARRAY':
      return value.value.map((text) => `"${cEscape(text)}"`).join(', ');
    default:
      return components(packedComponents(value.type, value.value));
  }
}

const structBody = (value: StructVariant): string =>
  (MATH_LAYOUT[value.type].component === 'int32' ? ints : components)(componentsOf(value));

/**
 * `VariantWriter::write_to_string` (variant_parser.cpp:2570), as `var_to_str` calls it.
 *
 * @canonical The text var_to_str writes for a Variant
 */
export function variantToText(value: Variant): string {
  return written(value, 0);
}
