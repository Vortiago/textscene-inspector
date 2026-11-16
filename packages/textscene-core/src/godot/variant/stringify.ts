import { numReal, numRealFloat, stringNum } from '../string/stringNumber.js';
import type { Variant } from './value/variant.js';

type Components = object;

const component = (value: Components, key: string) => (value as Record<string, number>)[key]!;
const realList = (value: Components, keys: readonly string[], trailing: boolean) =>
  `(${keys.map((key) => numRealFloat(component(value, key), trailing)).join(', ')})`;
const intList = (value: Components, keys: readonly string[]) =>
  `(${keys.map((key) => component(value, key)).join(', ')})`;

const XY = ['x', 'y'];
const XYZ = ['x', 'y', 'z'];
const XYZW = ['x', 'y', 'z', 'w'];

const vector2 = (v: Components) => realList(v, XY, true);
const vector3 = (v: Components) => realList(v, XYZ, true);
const vector4 = (v: Components) => realList(v, XYZW, true);

// String::c_escape (ustring.cpp:4477), in its order of replacements.
const ESCAPES: readonly (readonly [string, string])[] = [
  ['\\', '\\\\'],
  ['\x07', '\\a'],
  ['\b', '\\b'],
  ['\f', '\\f'],
  ['\n', '\\n'],
  ['\r', '\\r'],
  ['\t', '\\t'],
  ['\v', '\\v'],
  ["'", "\\'"],
  ['"', '\\"'],
];

function cEscape(text: string): string {
  return ESCAPES.reduce((escaped, [from, to]) => escaped.replaceAll(from, to), text);
}

// stringify_variant_clean (variant.cpp:1568): an element of a container quotes its strings.
function elementText(value: Variant): string {
  const text = stringify(value);
  if (value.type === 'STRING') return `"${cEscape(text)}"`;
  if (value.type === 'STRING_NAME') return `&"${cEscape(text)}"`;
  if (value.type === 'NODE_PATH') return `^"${cEscape(text)}"`;
  return text;
}

function listText(elements: readonly Variant[]): string {
  return `[${elements.map(elementText).join(', ')}]`;
}

function packedText(value: Variant & { value: readonly unknown[] }, elementType: Variant['type']): string {
  return listText(value.value.map((element) => ({ type: elementType, value: element }) as Variant));
}

export function stringify(value: Variant): string {
  switch (value.type) {
    case 'NIL':
      return '<null>';
    case 'BOOL':
      return value.value ? 'true' : 'false';
    case 'INT':
      return `${value.value}`;
    case 'RID':
      return `RID(${BigInt.asIntN(64, value.value)})`;
    case 'FLOAT':
      return numReal(value.value, true);
    case 'STRING':
    case 'STRING_NAME':
    case 'NODE_PATH':
      return value.value;
    case 'VECTOR2':
      return vector2(value.value);
    case 'VECTOR3':
      return vector3(value.value);
    case 'VECTOR4':
      return vector4(value.value);
    case 'VECTOR2I':
      return intList(value.value, XY);
    case 'VECTOR3I':
      return intList(value.value, XYZ);
    case 'VECTOR4I':
      return intList(value.value, XYZW);
    case 'QUATERNION':
      return realList(value.value, XYZW, false);
    case 'COLOR': {
      const { r, g, b, a } = value.value;
      return `(${[r, g, b, a].map((component) => stringNum(component, 4)).join(', ')})`;
    }
    case 'RECT2': {
      const { x, y, w, h } = value.value;
      return `[P: ${vector2({ x, y })}, S: ${vector2({ x: w, y: h })}]`;
    }
    case 'RECT2I': {
      const { x, y, w, h } = value.value;
      return `[P: ${intList({ x, y }, XY)}, S: ${intList({ x: w, y: h }, XY)}]`;
    }
    case 'TRANSFORM2D': {
      const { a, b, c, d, tx, ty } = value.value;
      return `[X: ${vector2({ x: a, y: b })}, Y: ${vector2({ x: c, y: d })}, O: ${vector2({ x: tx, y: ty })}]`;
    }
    case 'PLANE':
      return `[N: ${vector3(value.value.normal)}, D: ${numRealFloat(value.value.d, false)}]`;
    case 'AABB':
      return `[P: ${vector3(value.value.position)}, S: ${vector3(value.value.size)}]`;
    case 'BASIS':
      return basisText(value.value, '');
    case 'TRANSFORM3D': {
      const { basis_x: x, basis_y: y, basis_z: z, origin } = value.value;
      return basisText([x.x, x.y, x.z, y.x, y.y, y.z, z.x, z.y, z.z], `, O: ${vector3(origin)}`);
    }
    case 'PROJECTION': {
      const [x, y, z, w] = value.value.map(vector4);
      return `[X: ${x}, Y: ${y}, Z: ${z}, W: ${w}]`;
    }
    case 'OBJECT':
      return '<Object#null>';
    case 'CALLABLE':
      return value.value === '' ? 'null::null' : `null::${value.value}`;
    case 'SIGNAL':
      return `null::[signal]${value.value}`;
    case 'ARRAY':
      return listText(value.value);
    case 'DICTIONARY':
      return `{ ${value.value.map(({ key, value: entry }) => `${elementText(key)}: ${elementText(entry)}`).join(', ')} }`;
    case 'PACKED_BYTE_ARRAY':
    case 'PACKED_INT32_ARRAY':
    case 'PACKED_INT64_ARRAY':
      return `[${value.value.join(', ')}]`;
    case 'PACKED_FLOAT32_ARRAY':
    case 'PACKED_FLOAT64_ARRAY':
      return packedText(value, 'FLOAT');
    case 'PACKED_STRING_ARRAY':
      return packedText(value, 'STRING');
    case 'PACKED_VECTOR2_ARRAY':
      return packedText(value, 'VECTOR2');
    case 'PACKED_VECTOR3_ARRAY':
      return packedText(value, 'VECTOR3');
    case 'PACKED_COLOR_ARRAY':
      return packedText(value, 'COLOR');
    case 'PACKED_VECTOR4_ARRAY':
      return packedText(value, 'VECTOR4');
  }
}

// Basis::operator String (basis.cpp:708) writes the columns of the row-major components.
function basisText(n: readonly number[], origin: string): string {
  const column = (i: number) => vector3({ x: n[i]!, y: n[i + 3]!, z: n[i + 6]! });
  return `[X: ${column(0)}, Y: ${column(1)}, Z: ${column(2)}${origin}]`;
}
