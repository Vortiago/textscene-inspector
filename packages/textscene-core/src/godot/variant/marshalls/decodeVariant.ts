import { canInstantiate } from '../../classdb/classBaseTypes.js';
import { defaultValue } from '../value/defaultValue.js';
import { isMathType, MATH_LAYOUT, PACKED_STRUCT, structOf } from '../value/mathLayout.js';
import type { NodePathParts } from '../../string/nodePathParts.js';
import { storedReal } from '../../math/real.js';
import { setEntry } from '../compare.js';
import { typedArray, typedDictionary, validatedElement } from '../construct/typedContainer.js';
import { makeObject } from '../objects/makeObject.js';
import { UnportableUtility } from '../utility/unportableUtility.js';
import {
  NIL,
  variant,
  type ContainerType,
  type DictionaryEntry,
  type Variant,
  type VariantOf,
} from '../value/variant.js';
import { VARIANT_TYPE } from '../variantType.js';
import {
  CONTAINER_KIND,
  DICTIONARY_KEY_SHIFT,
  DICTIONARY_VALUE_SHIFT,
  ENCODED_OBJECT_CLASS,
  FLAG_64,
  FLAG_OBJECT_AS_ID,
  HEADER_TYPE_MASK,
  MAX_RECURSION_DEPTH,
  TYPED_ARRAY_SHIFT,
} from './marshallsFormat.js';

const TYPE_NAMES = Object.keys(VARIANT_TYPE) as (keyof typeof VARIANT_TYPE)[];
const INT_MAX = 2 ** 31 - 1;
const UTF8 = new TextDecoder('utf-8', { fatal: true });

/** A `decode_variant` error: `bytes_to_var` then returns null. */
class DecodeFault extends Error {}

const fail = (message: string): never => {
  throw new DecodeFault(message);
};

export interface Decoded {
  readonly value: Variant;
  readonly used: number;
}

// `String::append_utf8` (ustring.cpp:1750): a leading BOM is skipped and a NUL ends the text.
function utf8Text(bytes: Uint8Array): string {
  const nul = bytes.indexOf(0, bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0);
  try {
    return UTF8.decode(nul < 0 ? bytes : bytes.subarray(0, nul));
  } catch {
    return fail('Invalid UTF-8');
  }
}

/** One `decode_variant` call: its count of bytes left can pass the end, as a byte array counts padding. */
class VariantDecoder {
  readonly #view: DataView;
  #at: number;
  #left: number;
  #used = 0;

  constructor(
    readonly bytes: Uint8Array,
    start: number,
    left: number,
    readonly allowObjects: boolean,
    readonly depth: number
  ) {
    this.#view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.#at = start;
    this.#left = left;
  }

  #need(count: number): void {
    if (this.#left < count) fail(`expected ${count} more bytes, got ${this.#left}`);
  }

  #skip(count: number): void {
    this.#at += count;
    this.#left -= count;
    this.#used += count;
  }

  #int32(): number {
    this.#need(4);
    const value = this.#view.getInt32(this.#at, true);
    this.#skip(4);
    return value;
  }

  #uint64(): bigint {
    this.#need(8);
    const value = this.#view.getBigUint64(this.#at, true);
    this.#skip(8);
    return value;
  }

  #reals(count: number, isWide: boolean): number[] {
    const width = isWide ? 8 : 4;
    this.#need(width * count);
    const values = Array.from({ length: count }, (_, index) => {
      const at = this.#at + index * width;
      return storedReal(isWide ? this.#view.getFloat64(at, true) : this.#view.getFloat32(at, true));
    });
    this.#skip(width * count);
    return values;
  }

  /** `_decode_string` (marshalls.cpp:91). */
  #string(): string {
    const length = this.#int32();
    const pad = length % 4 === 0 ? 0 : 4 - (length % 4);
    if (length < 0 || pad < 0 || length > INT_MAX - pad || length + pad > this.#left)
      fail('string past the end');
    const text = utf8Text(this.bytes.subarray(this.#at, this.#at + length));
    this.#skip(length + pad);
    return text;
  }

  #nested(): Variant {
    const { value, used } = decodeAt(this.bytes, this.#at, this.#left, this.allowObjects, this.depth + 1);
    this.#skip(used);
    return value;
  }

  /** `decode_variant` (marshalls.cpp:185). */
  decode(): Decoded {
    if (this.depth > MAX_RECURSION_DEPTH) fail('Variant is too deep');
    const header = this.#int32() >>> 0;
    const typeName = TYPE_NAMES[header & HEADER_TYPE_MASK] ?? fail('type past VARIANT_MAX');
    const isWide = (header & FLAG_64) !== 0;
    return { value: this.#value(typeName, header, isWide), used: this.#used };
  }

  #value(type: (typeof TYPE_NAMES)[number], header: number, isWide: boolean): Variant {
    switch (type) {
      case 'NIL':
        return NIL;
      case 'BOOL':
        return variant('BOOL', this.#int32() !== 0);
      case 'INT':
        return variant('INT', isWide ? BigInt.asIntN(64, this.#uint64()) : BigInt(this.#int32()));
      case 'FLOAT':
        return variant('FLOAT', this.#float(isWide));
      case 'STRING':
        return variant('STRING', this.#string());
      case 'STRING_NAME':
        return variant('STRING_NAME', this.#string());
      case 'NODE_PATH':
        return variant('NODE_PATH', this.#nodePath());
      case 'RID':
        return variant('RID', BigInt.asIntN(64, this.#uint64()));
      case 'OBJECT':
        return this.#object(header);
      case 'CALLABLE':
        return defaultValue('CALLABLE');
      case 'SIGNAL':
        return this.#signal();
      case 'DICTIONARY':
        return this.#dictionary(header);
      case 'ARRAY':
        return this.#array(header);
      default:
        return this.#plain(type, isWide);
    }
  }

  #float(isWide: boolean): number {
    this.#need(isWide ? 8 : 4);
    const value = isWide ? this.#view.getFloat64(this.#at, true) : this.#view.getFloat32(this.#at, true);
    this.#skip(isWide ? 8 : 4);
    return value;
  }

  // marshalls.cpp:620: only the format with the high bit set is read, and flag 2 adds one subname.
  #nodePath(): NodePathParts {
    this.#need(4);
    const nameCount = this.#view.getUint32(this.#at, true);
    if ((nameCount & 0x80000000) === 0) fail('old NodePath format');
    this.#need(12);
    const subnameCount = this.#view.getUint32(this.#at + 4, true);
    const flags = this.#view.getUint32(this.#at + 8, true);
    this.#skip(12);
    const names = (nameCount & 0x7fffffff) >>> 0;
    const total = (names + subnameCount + ((flags & 2) !== 0 ? 1 : 0)) >>> 0;
    const parts: string[] = [];
    for (let index = 0; index < total; index++) parts.push(this.#string());
    return { absolute: (flags & 1) !== 0, names: parts.slice(0, names), subnames: parts.slice(names) };
  }

  #object(header: number): Variant {
    if ((header & FLAG_OBJECT_AS_ID) !== 0) {
      const id = this.#uint64();
      if (id === 0n) return variant('OBJECT', null);
      return makeObject(`bytes_to_var of the EncodedObjectAsID of object ${id}`);
    }
    if (!this.allowObjects) fail('objects are not allowed');
    const className = this.#string();
    if (className === '') return variant('OBJECT', null);
    if (!canInstantiate(className)) fail(`class ${className} cannot be instantiated`);
    this.#objectProperties();
    return makeObject(`bytes_to_var_with_objects of an object of class ${className}`);
  }

  // marshalls.cpp:740: the properties decode before the object is used, so their faults still show.
  #objectProperties(): void {
    const count = this.#int32();
    for (let index = 0; index < count; index++) {
      const name = this.#string();
      const value = this.#nested();
      if (name !== 'script' || value.type === 'NIL') continue;
      if (value.type !== 'STRING')
        fail('Invalid value for "script" property, expected script path as String.');
      const path = (value as VariantOf<'STRING'>).value;
      if (!path.startsWith('res://')) fail(`Invalid script path "${path}".`);
    }
  }

  // A Signal's object id names an object of the running editor, as instance_from_id's id does.
  #signal(): Variant {
    const name = this.#string();
    const id = this.#uint64();
    if (id !== 0n)
      throw new UnportableUtility(`bytes_to_var of a Signal of object ${id} of the running editor`);
    return variant('SIGNAL', name);
  }

  /** `_decode_container_type` (marshalls.cpp:126). */
  #containerType(kind: number): ContainerType | undefined {
    switch (kind) {
      case CONTAINER_KIND.NONE:
        return undefined;
      case CONTAINER_KIND.BUILTIN: {
        const type = this.#int32();
        if (type < 0 || type >= TYPE_NAMES.length) fail('container type past VARIANT_MAX');
        const isObject = type === VARIANT_TYPE.OBJECT && !this.allowObjects;
        return { type, className: isObject ? ENCODED_OBJECT_CLASS : '' };
      }
      case CONTAINER_KIND.CLASS_NAME: {
        const className = this.#string();
        return { type: VARIANT_TYPE.OBJECT, className: this.allowObjects ? className : ENCODED_OBJECT_CLASS };
      }
      default: {
        const path = this.#string();
        if (this.allowObjects) fail(`a container of the script ${path}`);
        return { type: VARIANT_TYPE.OBJECT, className: ENCODED_OBJECT_CLASS };
      }
    }
  }

  #count(): number {
    return this.#int32() & 0x7fffffff;
  }

  // `dict[key] = value` (marshalls.cpp:841) validates the key alone: a refused key drops the entry.
  #dictionary(header: number): Variant {
    const keyType = this.#containerType((header >> DICTIONARY_KEY_SHIFT) & 0b11);
    const valueType = this.#containerType((header >> DICTIONARY_VALUE_SHIFT) & 0b11);
    const count = this.#count();
    const entries: DictionaryEntry[] = [];
    for (let index = 0; index < count; index++) {
      const key = validatedElement(this.#nested(), keyType);
      const value = this.#nested();
      if (key) setEntry(entries, key, value);
    }
    return typedDictionary(entries, keyType, valueType);
  }

  // `Array::push_back` (array.cpp:282) refuses an element the type does not take.
  #array(header: number): Variant {
    const elementType = this.#containerType((header >> TYPED_ARRAY_SHIFT) & 0b11);
    const count = this.#count();
    const elements: Variant[] = [];
    for (let index = 0; index < count; index++) {
      const element = validatedElement(this.#nested(), elementType);
      if (element) elements.push(element);
    }
    return typedArray(elements, elementType);
  }

  #plain(type: (typeof TYPE_NAMES)[number], isWide: boolean): Variant {
    if (!isMathType(type)) return this.#packed(type, isWide);
    const { component, count } = MATH_LAYOUT[type];
    return structOf(
      type,
      component === 'int32' ? this.#ints(count) : this.#reals(count, component === 'real' && isWide)
    );
  }

  #ints(count: number): number[] {
    return Array.from({ length: count }, () => this.#int32());
  }

  /** The count of a packed array of `width`-byte elements, refused past the bytes left (marshalls.cpp:57). */
  #packedCount(width: number): number {
    const count = this.#int32();
    if (count < 0 || count > Math.floor(INT_MAX / width) || count * width > this.#left)
      fail('packed array past the end');
    return count;
  }

  #packed(type: (typeof TYPE_NAMES)[number], isWide: boolean): Variant {
    switch (type) {
      case 'PACKED_BYTE_ARRAY': {
        const count = this.#int32();
        if (count < 0 || count > this.#left) fail('byte array past the end');
        const bytes = [...this.bytes.subarray(this.#at, this.#at + count)];
        this.#skip(count + (count % 4 === 0 ? 0 : 4 - (count % 4)));
        return variant('PACKED_BYTE_ARRAY', bytes);
      }
      case 'PACKED_INT32_ARRAY':
        return variant('PACKED_INT32_ARRAY', this.#ints(this.#packedCount(4)));
      case 'PACKED_INT64_ARRAY': {
        const count = this.#packedCount(8);
        return variant(
          'PACKED_INT64_ARRAY',
          Array.from({ length: count }, () => BigInt.asIntN(64, this.#uint64()))
        );
      }
      case 'PACKED_FLOAT32_ARRAY':
        return variant('PACKED_FLOAT32_ARRAY', this.#reals(this.#packedCount(4), false));
      case 'PACKED_FLOAT64_ARRAY': {
        const count = this.#packedCount(8);
        return variant(
          'PACKED_FLOAT64_ARRAY',
          Array.from({ length: count }, () => this.#float(true))
        );
      }
      case 'PACKED_STRING_ARRAY': {
        const count = this.#int32();
        const strings: string[] = [];
        for (let index = 0; index < count; index++) strings.push(this.#string());
        return variant('PACKED_STRING_ARRAY', strings);
      }
      default: {
        const struct = PACKED_STRUCT[type]!;
        const { component, count } = MATH_LAYOUT[struct];
        const isWideElement = component === 'real' && isWide;
        const elements = this.#vectors(count, isWideElement ? 8 : 4, isWideElement);
        return variant(
          type as 'PACKED_VECTOR2_ARRAY',
          elements.map((c) => structOf(struct, c).value) as never
        );
      }
    }
  }

  #vectors(size: number, width: number, isWide: boolean): number[][] {
    const count = this.#packedCount(size * width);
    return Array.from({ length: count }, () => this.#reals(size, isWide));
  }
}

function decodeAt(
  bytes: Uint8Array,
  start: number,
  left: number,
  allowObjects: boolean,
  depth: number
): Decoded {
  return new VariantDecoder(bytes, start, left, allowObjects, depth).decode();
}

/**
 * `bytes_to_var` and `bytes_to_var_with_objects` (variant_utility.cpp:1096): null when decoding fails.
 *
 * @canonical The Variant bytes_to_var reads from bytes
 */
export const bytesToVariant = (bytes: readonly number[], allowObjects: boolean): Variant =>
  decodedAt(bytes, 0, allowObjects)?.value ?? NIL;

/** `decode_variant` from `start` to the end: the value and the bytes it takes, or nothing where it fails. */
export function decodedAt(
  bytes: readonly number[],
  start: number,
  allowObjects: boolean
): Decoded | undefined {
  try {
    return decodeAt(Uint8Array.from(bytes), start, bytes.length - start, allowObjects, 0);
  } catch (error) {
    if (error instanceof DecodeFault) return undefined;
    throw error;
  }
}
