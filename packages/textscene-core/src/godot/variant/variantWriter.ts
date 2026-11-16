/**
 * How Godot's text format spells a number (`VariantWriter::write`, `core/variant/variant_parser.cpp`),
 * for a reader that turns another serialisation into that text.
 */

import { formatReal, shortestReal, storedReal } from '../math/real.js';
import { cEscape, cEscapeMultiline } from '../string/cEscape.js';
import { nodePathFromParts } from '../string/nodePathParts.js';
import { isStringLess } from '../string/stringOrder.js';
import { sortArray } from '../templates/sortArray.js';
import { isVariantLess } from './operators/evaluate.js';
import type { ContainerType, DictionaryEntry, Variant, VariantOf } from './value/variant.js';
import { variantTypeName, variantTypeNameOf } from './variantType.js';

/**
 * `rtos_fix` (`variant_parser.cpp:1985-1999`): zero without its sign, and the shortest float32
 * spelling for a value a float32 holds exactly, so a stored float carries no garbage digits.
 * `String::num_scientific` writes `inf`, `-inf` and `nan` for the non-finite values. JavaScript
 * spells `-0` as `0` already.
 */
export function componentLiteral(value: number): string {
  if (!Number.isFinite(value)) return formatReal(value);
  return grisuLayout(storedReal(value) === value ? shortestReal(value) : value);
}

/**
 * The magnitudes `grisu2::to_chars` writes in decimal notation, decimal exponents -4 to 14. Outside
 * them it writes scientific notation with a signed exponent of at least two digits (measured with
 * Godot 4.6.3's `var_to_str`, as the local source holds no `thirdparty/grisu2`).
 */
const DECIMAL_MAGNITUDE_MIN = 1e-4;
const DECIMAL_MAGNITUDE_END = 1e15;

/**
 * `shortest` holds the fewest digits that read back as the value, which JavaScript also prints. Its
 * `String` is decimal from 1e-6 to 1e21, so it covers the decimal range.
 */
function grisuLayout(shortest: number): string {
  const magnitude = Math.abs(shortest);
  if (magnitude === 0 || (magnitude >= DECIMAL_MAGNITUDE_MIN && magnitude < DECIMAL_MAGNITUDE_END))
    return String(shortest);
  const [mantissa, exponentText] = shortest.toExponential().split('e') as [string, string];
  const exponent = Number(exponentText);
  const sign = exponent < 0 ? '-' : '+';
  return `${mantissa}e${sign}${String(Math.abs(exponent)).padStart(2, '0')}`;
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

// typedefs.h:380: a container deeper than this writes empty, after an error Godot only prints.
const MAX_RECURSION = 100;

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

const vector = ({ x, y, z, w }: { x: number; y: number; z?: number; w?: number }) =>
  [x, y, z, w].filter((component) => component !== undefined) as number[];

function written(value: Variant, depth: number): string {
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
    case 'VECTOR2':
    case 'VECTOR3':
    case 'VECTOR4':
    case 'QUATERNION':
      return call(variantTypeNameOf(value.type), components(vector(value.value)));
    case 'VECTOR2I':
    case 'VECTOR3I':
    case 'VECTOR4I':
      return call(variantTypeNameOf(value.type), ints(vector(value.value)));
    case 'RECT2':
      return call('Rect2', components([value.value.x, value.value.y, value.value.w, value.value.h]));
    case 'RECT2I':
      return call('Rect2i', ints([value.value.x, value.value.y, value.value.w, value.value.h]));
    case 'PLANE':
      return call('Plane', components([...vector(value.value.normal), value.value.d]));
    case 'AABB':
      return call('AABB', components([...vector(value.value.position), ...vector(value.value.size)]));
    case 'TRANSFORM2D': {
      const { a, b, c, d, tx, ty } = value.value;
      return call('Transform2D', components([a, b, c, d, tx, ty]));
    }
    case 'BASIS':
      return call('Basis', components(value.value));
    case 'TRANSFORM3D': {
      const { basis_x, basis_y, basis_z, origin } = value.value;
      return call('Transform3D', components([basis_x, basis_y, basis_z, origin].flatMap(vector)));
    }
    case 'PROJECTION':
      return call('Projection', components(value.value.flatMap(vector)));
    case 'COLOR':
      return call('Color', components([value.value.r, value.value.g, value.value.b, value.value.a]));
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
    case 'PACKED_COLOR_ARRAY':
      return components(value.value.flatMap(({ r, g, b, a }) => [r, g, b, a]));
    default:
      return components(value.value.flatMap(vector));
  }
}

/**
 * `VariantWriter::write_to_string` (variant_parser.cpp:2570), as `var_to_str` calls it.
 *
 * @canonical The text var_to_str writes for a Variant
 */
export function variantToText(value: Variant): string {
  return written(value, 0);
}
