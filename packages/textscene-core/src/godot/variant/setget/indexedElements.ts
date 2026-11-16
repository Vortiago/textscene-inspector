import { basisColumn } from '../../math/basis.js';
import { variant, type Variant, type Vector3Value, type Vector4Value } from '../value/variant.js';

const real = (value: number) => variant('FLOAT', value);
const int = (value: number | bigint) => variant('INT', BigInt(value));
const xyz = ({ x, y, z }: Vector3Value) => [x, y, z];
const xyzw = ({ x, y, z, w }: Vector4Value) => [x, y, z, w];

/** The elements of a type with a fixed size, which refuses a negative index (variant_setget.cpp:595). */
function fixedElements(value: Variant): readonly Variant[] | undefined {
  switch (value.type) {
    case 'VECTOR2':
      return [value.value.x, value.value.y].map(real);
    case 'VECTOR2I':
      return [value.value.x, value.value.y].map(int);
    case 'VECTOR3':
      return xyz(value.value).map(real);
    case 'VECTOR3I':
      return xyz(value.value).map(int);
    case 'VECTOR4':
    case 'QUATERNION':
      return xyzw(value.value).map(real);
    case 'VECTOR4I':
      return xyzw(value.value).map(int);
    case 'COLOR':
      return [value.value.r, value.value.g, value.value.b, value.value.a].map(real);
    case 'TRANSFORM2D': {
      const { a, b, c, d, tx, ty } = value.value;
      return [
        variant('VECTOR2', { x: a, y: b }),
        variant('VECTOR2', { x: c, y: d }),
        variant('VECTOR2', { x: tx, y: ty }),
      ];
    }
    case 'BASIS': {
      const basis = value.value;
      return [0, 1, 2].map((column) => {
        const [x, y, z] = basisColumn(basis, column);
        return variant('VECTOR3', { x, y, z });
      });
    }
    case 'PROJECTION':
      return value.value.map((column) => variant('VECTOR4', column));
    default:
      return undefined;
  }
}

/** The elements of a String, an Array or a packed array, which count a negative index from the end. */
function sequenceElements(value: Variant): readonly Variant[] | undefined {
  switch (value.type) {
    case 'STRING':
      return Array.from(value.value, (character) => variant('STRING', character));
    case 'ARRAY':
      return value.value;
    case 'PACKED_BYTE_ARRAY':
    case 'PACKED_INT32_ARRAY':
    case 'PACKED_INT64_ARRAY':
      return (value.value as readonly (number | bigint)[]).map(int);
    case 'PACKED_FLOAT32_ARRAY':
    case 'PACKED_FLOAT64_ARRAY':
      return value.value.map(real);
    case 'PACKED_STRING_ARRAY':
      return value.value.map((text) => variant('STRING', text));
    case 'PACKED_VECTOR2_ARRAY':
      return value.value.map((element) => variant('VECTOR2', element));
    case 'PACKED_VECTOR3_ARRAY':
      return value.value.map((element) => variant('VECTOR3', element));
    case 'PACKED_COLOR_ARRAY':
      return value.value.map((element) => variant('COLOR', element));
    case 'PACKED_VECTOR4_ARRAY':
      return value.value.map((element) => variant('VECTOR4', element));
    default:
      return undefined;
  }
}

/** `Variant::get_indexed` (variant_setget.cpp:984) of any type but a Dictionary, or nothing on failure. */
export function indexedElement(value: Variant, index: bigint): Variant | undefined {
  const fixed = fixedElements(value);
  if (fixed) return index >= 0n && index < BigInt(fixed.length) ? fixed[Number(index)] : undefined;
  const elements = sequenceElements(value) ?? [];
  const at = index < 0n ? index + BigInt(elements.length) : index;
  return at >= 0n && at < BigInt(elements.length) ? elements[Number(at)] : undefined;
}
