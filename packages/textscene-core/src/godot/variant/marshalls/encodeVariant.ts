import { nodePathParts } from '../../string/nodePath.js';
import type { ContainerType, Variant } from '../value/variant.js';
import { VARIANT_TYPE } from '../variantType.js';
import {
  CONTAINER_KIND,
  DICTIONARY_KEY_SHIFT,
  DICTIONARY_VALUE_SHIFT,
  ENCODED_OBJECT_CLASS,
  FLAG_64,
  MAX_RECURSION_DEPTH,
  TYPED_ARRAY_SHIFT,
} from './marshallsFormat.js';

const UTF8 = new TextEncoder();
const INT32_MIN = -(2n ** 31n);
const INT32_MAX = 2n ** 31n - 1n;

class EncodeFault extends Error {}

/** The little-endian bytes `encode_variant` writes, grown as it writes them. */
class ByteWriter {
  readonly bytes: number[] = [];
  readonly #scratch = new DataView(new ArrayBuffer(8));

  #copy(count: number): void {
    for (let index = 0; index < count; index++) this.bytes.push(this.#scratch.getUint8(index));
  }

  uint32(value: number): void {
    this.#scratch.setUint32(0, value >>> 0, true);
    this.#copy(4);
  }

  uint64(value: bigint): void {
    this.#scratch.setBigUint64(0, BigInt.asUintN(64, value), true);
    this.#copy(8);
  }

  float(value: number): void {
    this.#scratch.setFloat32(0, value, true);
    this.#copy(4);
  }

  double(value: number): void {
    this.#scratch.setFloat64(0, value, true);
    this.#copy(8);
  }

  raw(bytes: ArrayLike<number>): void {
    for (let index = 0; index < bytes.length; index++) this.bytes.push(bytes[index]!);
  }

  floats(values: readonly number[]): void {
    for (const value of values) this.float(value);
  }

  // Each variant starts at a multiple of 4, so padding to the writer's length pads the variant too.
  pad(): void {
    while (this.bytes.length % 4 !== 0) this.bytes.push(0);
  }

  /** `_encode_string` (marshalls.cpp:1305). */
  string(text: string): void {
    const utf8 = UTF8.encode(text);
    this.uint32(utf8.length);
    this.raw(utf8);
    this.pad();
  }
}

function containerKind(type: ContainerType | undefined): number {
  if (!type || type.type === VARIANT_TYPE.NIL) return CONTAINER_KIND.NONE;
  return type.className === '' ? CONTAINER_KIND.BUILTIN : CONTAINER_KIND.CLASS_NAME;
}

const xyz = ({ x, y, z }: { x: number; y: number; z: number }) => [x, y, z];
const xyzw = ({ x, y, z, w }: { x: number; y: number; z: number; w: number }) => [x, y, z, w];

class VariantEncoder {
  readonly #out = new ByteWriter();

  constructor(readonly fullObjects: boolean) {}

  get bytes(): number[] {
    return this.#out.bytes;
  }

  #containerType(type: ContainerType | undefined): void {
    const kind = containerKind(type);
    if (kind === CONTAINER_KIND.BUILTIN) this.#out.uint32(type!.type);
    if (kind === CONTAINER_KIND.CLASS_NAME)
      this.#out.string(this.fullObjects ? type!.className : ENCODED_OBJECT_CLASS);
  }

  /** `encode_variant` (marshalls.cpp:1361). */
  encode(value: Variant, depth: number): void {
    if (depth > MAX_RECURSION_DEPTH) throw new EncodeFault('Potential infinite recursion detected');
    const out = this.#out;
    const type = VARIANT_TYPE[value.type];
    switch (value.type) {
      case 'NIL':
      case 'OBJECT':
      case 'CALLABLE':
        // An expression's objects are all null, which encode as Nil (marshalls.cpp:1386).
        return out.uint32(value.type === 'CALLABLE' ? type : VARIANT_TYPE.NIL);
      case 'BOOL':
        out.uint32(type);
        return out.uint32(value.value ? 1 : 0);
      case 'INT': {
        const isWide = value.value > INT32_MAX || value.value < INT32_MIN;
        out.uint32(type | (isWide ? FLAG_64 : 0));
        return isWide ? out.uint64(value.value) : out.uint32(Number(BigInt.asUintN(32, value.value)));
      }
      case 'FLOAT': {
        const isWide = Math.fround(value.value) !== value.value;
        out.uint32(type | (isWide ? FLAG_64 : 0));
        return isWide ? out.double(value.value) : out.float(value.value);
      }
      case 'STRING':
      case 'STRING_NAME':
        out.uint32(type);
        return out.string(value.value);
      case 'NODE_PATH':
        out.uint32(type);
        return this.#nodePath(value.value);
      case 'RID':
        out.uint32(type);
        return out.uint64(value.value);
      case 'SIGNAL':
        out.uint32(type);
        out.string(value.value);
        return out.uint64(0n);
      case 'DICTIONARY': {
        out.uint32(
          type |
            (containerKind(value.keyType) << DICTIONARY_KEY_SHIFT) |
            (containerKind(value.valueType) << DICTIONARY_VALUE_SHIFT)
        );
        this.#containerType(value.keyType);
        this.#containerType(value.valueType);
        out.uint32(value.value.length);
        for (const entry of value.value) {
          this.encode(entry.key, depth + 1);
          this.encode(entry.value, depth + 1);
        }
        return;
      }
      case 'ARRAY':
        out.uint32(type | (containerKind(value.elementType) << TYPED_ARRAY_SHIFT));
        this.#containerType(value.elementType);
        out.uint32(value.value.length);
        for (const element of value.value) this.encode(element, depth + 1);
        return;
      default:
        out.uint32(type);
        return this.#plain(value);
    }
  }

  #nodePath(text: string): void {
    const { absolute, names, subnames } = nodePathParts(text)!;
    this.#out.uint32((names.length | 0x80000000) >>> 0);
    this.#out.uint32(subnames.length);
    this.#out.uint32(absolute ? 1 : 0);
    for (const name of [...names, ...subnames]) this.#out.string(name);
  }

  #plain(value: Variant): void {
    const out = this.#out;
    switch (value.type) {
      case 'VECTOR2':
        return out.floats([value.value.x, value.value.y]);
      case 'VECTOR2I':
        return [value.value.x, value.value.y].forEach((n) => out.uint32(n));
      case 'RECT2':
        return out.floats([value.value.x, value.value.y, value.value.w, value.value.h]);
      case 'RECT2I':
        return [value.value.x, value.value.y, value.value.w, value.value.h].forEach((n) => out.uint32(n));
      case 'VECTOR3':
        return out.floats(xyz(value.value));
      case 'VECTOR3I':
        return xyz(value.value).forEach((n) => out.uint32(n));
      case 'TRANSFORM2D': {
        const { a, b, c, d, tx, ty } = value.value;
        return out.floats([a, b, c, d, tx, ty]);
      }
      case 'VECTOR4':
      case 'QUATERNION':
        return out.floats(xyzw(value.value));
      case 'VECTOR4I':
        return xyzw(value.value).forEach((n) => out.uint32(n));
      case 'PLANE':
        return out.floats([...xyz(value.value.normal), value.value.d]);
      case 'AABB':
        return out.floats([...xyz(value.value.position), ...xyz(value.value.size)]);
      case 'BASIS':
        return out.floats(value.value);
      case 'TRANSFORM3D': {
        const { basis_x, basis_y, basis_z, origin } = value.value;
        return out.floats([basis_x, basis_y, basis_z, origin].flatMap(xyz));
      }
      case 'PROJECTION':
        return out.floats(value.value.flatMap(xyzw));
      case 'COLOR':
        return out.floats([value.value.r, value.value.g, value.value.b, value.value.a]);
      default:
        return this.#packed(value);
    }
  }

  #packed(value: Variant): void {
    const out = this.#out;
    const elements = value.value as readonly unknown[];
    out.uint32(elements.length);
    switch (value.type) {
      case 'PACKED_BYTE_ARRAY':
        out.raw(value.value);
        return out.pad();
      case 'PACKED_INT32_ARRAY':
        return value.value.forEach((n) => out.uint32(n));
      case 'PACKED_INT64_ARRAY':
        return value.value.forEach((n) => out.uint64(n));
      case 'PACKED_FLOAT32_ARRAY':
        return out.floats(value.value);
      case 'PACKED_FLOAT64_ARRAY':
        return value.value.forEach((n) => out.double(n));
      case 'PACKED_STRING_ARRAY':
        // Each element keeps its NUL in the length (marshalls.cpp:1987).
        return value.value.forEach((text) => out.string(`${text}\0`));
      case 'PACKED_VECTOR2_ARRAY':
        return out.floats(value.value.flatMap(({ x, y }) => [x, y]));
      case 'PACKED_VECTOR3_ARRAY':
        return out.floats(value.value.flatMap(xyz));
      case 'PACKED_COLOR_ARRAY':
        return out.floats(value.value.flatMap(({ r, g, b, a }) => [r, g, b, a]));
      case 'PACKED_VECTOR4_ARRAY':
        return out.floats(value.value.flatMap(xyzw));
      default:
        throw new Error(`expected a packed array, got ${value.type}`);
    }
  }
}

/**
 * `var_to_bytes` and `var_to_bytes_with_objects` (variant_utility.cpp:1056): empty when encoding fails.
 *
 * @canonical The bytes var_to_bytes writes for a Variant
 */
export function variantToBytes(value: Variant, fullObjects: boolean): number[] {
  const encoder = new VariantEncoder(fullObjects);
  try {
    encoder.encode(value, 0);
  } catch (error) {
    if (error instanceof EncodeFault) return [];
    throw error;
  }
  return encoder.bytes;
}
