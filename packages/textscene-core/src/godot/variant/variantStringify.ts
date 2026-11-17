import { VARIANT_TYPE } from './variantType.js';
import { cEscape } from './varToStr.js';
import { componentsOf, packedElements, type VariantValue } from './variantValue.js';

const T = VARIANT_TYPE;

/** `MAX_DECIMALS` (`ustring.cpp:61`). */
const MAX_DECIMALS = 32;
/** The precision `%lf` takes when `String::num` is given no decimals. */
const PRINTF_DEFAULT_DECIMALS = 6;
const INT64_LIMIT = 2 ** 63;

/** `printf("%.*lf")`, which rounds an exact tie to even where `toFixed` rounds it away from zero. */
function printFixed(value: number, decimals: number): string {
  const fixed = value.toFixed(decimals);
  const exact = value.toFixed(Math.min(100, decimals + 30));
  const rest = exact.slice(exact.length - 30);
  if (!/^50*$/.test(rest)) return fixed;
  const truncated = exact.slice(0, exact.length - 30).replace(/\.$/, '');
  const lastDigit = Number(truncated.at(-1));
  return lastDigit % 2 === 0 ? truncated : fixed;
}

/** Trailing zeros after the point go, except the one right after it (`ustring.cpp:1468-1495`). */
function stripTrailingZeros(text: string): string {
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '.0') : text;
}

/** `String::num` (`ustring.cpp:1405-1498`). */
export function num(value: number, decimals = -1): string {
  if (Number.isNaN(value)) return 'nan';
  if (!Number.isFinite(value)) return value < 0 ? '-inf' : 'inf';
  let places = decimals;
  if (places < 0) {
    places = 14;
    if (Math.abs(value) > 10) places -= Math.floor(Math.log10(Math.abs(value)));
  }
  places = Math.min(places, MAX_DECIMALS);
  return stripTrailingZeros(printFixed(value, places < 0 ? PRINTF_DEFAULT_DECIMALS : places));
}

function isInt64Integral(value: number): boolean {
  return Math.abs(value) < INT64_LIMIT && Number.isInteger(value);
}

/** `String::num_real` (`ustring.cpp:1572-1617`): `digits` is 14 for a double and 6 for a float. */
function numReal(value: number, hasTrailing: boolean, digits: number): string {
  if (!Number.isFinite(value)) return num(value, 0);
  if (isInt64Integral(value)) return `${value === 0 ? 0 : value}${hasTrailing ? '.0' : ''}`;
  const magnitude = Math.abs(value);
  return num(value, magnitude > 10 ? digits - Math.floor(Math.log10(magnitude)) : digits);
}

const DOUBLE_DIGITS = 14;
const FLOAT_DIGITS = 6;

const realText = (value: number) => numReal(value, true, FLOAT_DIGITS);
const intText = (value: number) => String(value === 0 ? 0 : value);

function tuple(values: readonly number[], text: (value: number) => string): string {
  return `(${values.map(text).join(', ')})`;
}

function labelled(labels: readonly string[], parts: readonly string[]): string {
  return `[${labels.map((label, i) => `${label}: ${parts[i]}`).join(', ')}]`;
}

/** Column `index` of a row-major basis. */
function basisColumn(m: readonly number[], index: number): number[] {
  return [m[index]!, m[3 + index]!, m[6 + index]!];
}

function stringifyComponents(type: number, m: readonly number[]): string {
  const vector = (values: readonly number[]) => tuple(values, realText);
  const vectorI = (values: readonly number[]) => tuple(values, intText);
  switch (type) {
    case T.VECTOR2:
    case T.VECTOR3:
    case T.VECTOR4:
      return vector(m);
    case T.VECTOR2I:
    case T.VECTOR3I:
    case T.VECTOR4I:
      return vectorI(m);
    case T.RECT2:
      return labelled(['P', 'S'], [vector(m.slice(0, 2)), vector(m.slice(2))]);
    case T.RECT2I:
      return labelled(['P', 'S'], [vectorI(m.slice(0, 2)), vectorI(m.slice(2))]);
    case T.AABB:
      return labelled(['P', 'S'], [vector(m.slice(0, 3)), vector(m.slice(3))]);
    case T.TRANSFORM2D:
      return labelled(['X', 'Y', 'O'], [vector(m.slice(0, 2)), vector(m.slice(2, 4)), vector(m.slice(4))]);
    case T.PLANE:
      return labelled(['N', 'D'], [vector(m.slice(0, 3)), numReal(m[3]!, false, FLOAT_DIGITS)]);
    case T.QUATERNION:
      return tuple(m, (value) => numReal(value, false, FLOAT_DIGITS));
    case T.BASIS:
      return labelled(
        ['X', 'Y', 'Z'],
        [0, 1, 2].map((i) => vector(basisColumn(m, i)))
      );
    case T.TRANSFORM3D:
      return labelled(
        ['X', 'Y', 'Z', 'O'],
        [...[0, 1, 2].map((i) => vector(basisColumn(m, i))), vector(m.slice(9))]
      );
    case T.PROJECTION:
      return labelled(
        ['X', 'Y', 'Z', 'W'],
        [0, 1, 2, 3].map((i) => vector(m.slice(i * 4, i * 4 + 4)))
      );
    case T.COLOR:
      return tuple(m, (value) => num(value, 4));
  }
  throw new Error(`expected a component type, got ${type}`);
}

/** `stringify_variant_clean` (`variant.cpp:1568-1587`): a string-like element in quotes. */
function stringifyClean(value: VariantValue): string {
  switch (value.type) {
    case T.STRING:
      return `"${cEscape(value.value)}"`;
    case T.STRING_NAME:
      return `&"${cEscape(value.value)}"`;
    case T.NODE_PATH:
      return `^"${cEscape(value.value)}"`;
  }
  return stringify(value);
}

function list(elements: readonly VariantValue[]): string {
  return `[${elements.map(stringifyClean).join(', ')}]`;
}

/** `Variant::stringify` (`variant.cpp:1603-1735`), what `str()` and a String setter receive. */
export function stringify(value: VariantValue): string {
  switch (value.type) {
    case T.NIL:
      return '<null>';
    case T.BOOL:
      return value.value ? 'true' : 'false';
    case T.INT:
      return intText(value.value);
    case T.FLOAT:
      return numReal(value.value, true, DOUBLE_DIGITS);
    case T.STRING:
    case T.STRING_NAME:
    case T.NODE_PATH:
      return value.value;
    case T.RID:
      return `RID(${value.value})`;
    case T.OBJECT:
      return value.resource || value.className ? `<${value.className ?? 'Resource'}>` : '<Object#null>';
    case T.CALLABLE:
    case T.SIGNAL:
      return 'null::null';
    case T.ARRAY:
      return list(value.elements);
    case T.DICTIONARY:
      return `{ ${value.entries.map(([k, v]) => `${stringifyClean(k)}: ${stringifyClean(v)}`).join(', ')} }`;
  }
  const components = componentsOf(value);
  return components ? stringifyComponents(value.type, components) : list(packedElements(value));
}
