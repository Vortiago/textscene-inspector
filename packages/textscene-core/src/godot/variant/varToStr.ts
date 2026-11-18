import { VARIANT_TYPE, variantTypeName } from './variantType.js';
import { componentLiteral, floatLiteral } from './variantWriter.js';
import { stringLiteral } from '../string/string.js';
import type { ContainerType, ResourceReference, VariantValue } from './variantValue.js';

const T = VARIANT_TYPE;

/** `String::c_escape` (`ustring.cpp:4477-4491`), which a StringName, a NodePath and a packed string take. */
export function cEscape(text: string): string {
  return text
    .replaceAll('\\', '\\\\')
    .replaceAll('\x07', '\\a')
    .replaceAll('\b', '\\b')
    .replaceAll('\f', '\\f')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
    .replaceAll('\t', '\\t')
    .replaceAll('\v', '\\v')
    .replaceAll("'", "\\'")
    .replaceAll('"', '\\"');
}

const COMPONENT_NAMES: Readonly<Partial<Record<number, string>>> = {
  [T.VECTOR2]: 'Vector2',
  [T.RECT2]: 'Rect2',
  [T.VECTOR3]: 'Vector3',
  [T.VECTOR4]: 'Vector4',
  [T.TRANSFORM2D]: 'Transform2D',
  [T.PLANE]: 'Plane',
  [T.QUATERNION]: 'Quaternion',
  [T.AABB]: 'AABB',
  [T.BASIS]: 'Basis',
  [T.TRANSFORM3D]: 'Transform3D',
  [T.PROJECTION]: 'Projection',
  [T.COLOR]: 'Color',
};

const INTEGER_COMPONENT_NAMES: Readonly<Partial<Record<number, string>>> = {
  [T.VECTOR2I]: 'Vector2i',
  [T.RECT2I]: 'Rect2i',
  [T.VECTOR3I]: 'Vector3i',
  [T.VECTOR4I]: 'Vector4i',
};

const PACKED_NAMES: Readonly<Partial<Record<number, string>>> = {
  [T.PACKED_INT32_ARRAY]: 'PackedInt32Array',
  [T.PACKED_INT64_ARRAY]: 'PackedInt64Array',
  [T.PACKED_FLOAT32_ARRAY]: 'PackedFloat32Array',
  [T.PACKED_FLOAT64_ARRAY]: 'PackedFloat64Array',
  [T.PACKED_VECTOR2_ARRAY]: 'PackedVector2Array',
  [T.PACKED_VECTOR3_ARRAY]: 'PackedVector3Array',
  [T.PACKED_COLOR_ARRAY]: 'PackedColorArray',
  [T.PACKED_VECTOR4_ARRAY]: 'PackedVector4Array',
};

/** `rtos_fix` (`variant_parser.cpp:1985-1999`): `0` for a zero of either sign. */
function realLiteral(value: number): string {
  return value === 0 ? '0' : componentLiteral(value);
}

function integerLiteral(value: number): string {
  return String(value === 0 ? 0 : value);
}

/** `encode_resource_reference` (`variant_parser.cpp:2001-2009`): the uid first where the file has one. */
function resourceLiteral({ path, uid }: ResourceReference): string {
  return uid ? `Resource("${uid}", "${cEscapeMultiline(path)}")` : `Resource("${cEscapeMultiline(path)}")`;
}

function cEscapeMultiline(text: string): string {
  return stringLiteral(text).slice(1, -1);
}

function containerTypeName(type: ContainerType | undefined): string {
  if (!type) return 'Variant';
  return 'className' in type ? type.className : variantTypeName(type.builtin)!;
}

/** `StringLikeVariantOrder`: strings and StringNames by their text, else by type, then by value. */
function keyOrder(a: VariantValue, b: VariantValue): number {
  const isStringLike = (v: VariantValue) => v.type === T.STRING || v.type === T.STRING_NAME;
  if (isStringLike(a) && isStringLike(b)) {
    const left = (a as { value: string }).value;
    const right = (b as { value: string }).value;
    return left < right ? -1 : left > right ? 1 : 0;
  }
  if (a.type !== b.type) return a.type - b.type;
  if ('value' in a && 'value' in b) return valueOrder(a.value, b.value);
  return 0;
}

function valueOrder(a: unknown, b: unknown): number {
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const order = valueOrder(a[i], b[i]);
      if (order !== 0) return order;
    }
    return a.length - b.length;
  }
  return (a as number) < (b as number) ? -1 : (a as number) > (b as number) ? 1 : 0;
}

function dictionaryText(value: Extract<VariantValue, { type: typeof T.DICTIONARY }>): string {
  const sorted = [...value.entries].sort(([a], [b]) => keyOrder(a, b));
  const body =
    sorted.length === 0
      ? '{}'
      : `{\n${sorted.map(([k, v]) => `${varToStr(k)}: ${varToStr(v)}`).join(',\n')}\n}`;
  if (!value.keyType && !value.valueType) return body;
  return `Dictionary[${containerTypeName(value.keyType)}, ${containerTypeName(value.valueType)}](${body})`;
}

function arrayText(value: Extract<VariantValue, { type: typeof T.ARRAY }>): string {
  const body = `[${value.elements.map(varToStr).join(', ')}]`;
  return value.elementType ? `Array[${containerTypeName(value.elementType)}](${body})` : body;
}

function objectText(value: Extract<VariantValue, { type: typeof T.OBJECT }>): string {
  if (value.resource) return resourceLiteral(value.resource);
  if (!value.className) return 'null';
  const properties = (value.properties ?? []).map(([name, v]) => `"${name}":${varToStr(v)}`).join(',');
  return `Object(${value.className},${properties})\n`;
}

/** `var_to_str` writes in the compatible form, a list of bytes, not base64: `variant_parser.h:163`. */
function bytesText(bytes: readonly number[]): string {
  return `PackedByteArray(${bytes.join(', ')})`;
}

/** `var_to_str` of `value`. */
export function varToStr(value: VariantValue): string {
  switch (value.type) {
    case T.NIL:
      return 'null';
    case T.BOOL:
      return value.value ? 'true' : 'false';
    case T.INT:
      return integerLiteral(value.value);
    case T.FLOAT:
      return value.value === 0 ? '0.0' : floatLiteral(value.value);
    case T.STRING:
      return stringLiteral(value.value);
    case T.STRING_NAME:
      return `&"${cEscape(value.value)}"`;
    case T.NODE_PATH:
      return `NodePath("${cEscape(value.value)}")`;
    case T.RID:
      return value.value === 0 ? 'RID()' : `RID(${value.value})`;
    case T.SIGNAL:
      return 'Signal()';
    case T.CALLABLE:
      return 'Callable()';
    case T.OBJECT:
      return objectText(value);
    case T.DICTIONARY:
      return dictionaryText(value);
    case T.ARRAY:
      return arrayText(value);
    case T.PACKED_BYTE_ARRAY:
      return bytesText(value.value);
    case T.PACKED_STRING_ARRAY:
      return `PackedStringArray(${value.value.map((text) => `"${cEscape(text)}"`).join(', ')})`;
  }
  const components = (value as { value: readonly number[] }).value;
  const integerName = INTEGER_COMPONENT_NAMES[value.type];
  if (integerName) return `${integerName}(${components.map(integerLiteral).join(', ')})`;
  const isWhole = value.type === T.PACKED_INT32_ARRAY || value.type === T.PACKED_INT64_ARRAY;
  const name = COMPONENT_NAMES[value.type] ?? PACKED_NAMES[value.type]!;
  return `${name}(${components.map(isWhole ? integerLiteral : realLiteral).join(', ')})`;
}
