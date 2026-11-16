import { writeAt } from '../../templates/arrayWrite.js';
import { halfToFloat, makeHalfFloat } from '../../math/halfFloat.js';
import { textOf } from '../../string/ustring/codes.js';
import { REPLACEMENT, utf8Codes } from '../../string/ustring/encodings.js';
import { GodotCrash, wrapInt32 } from '../cInteger.js';
import { decodedAt } from '../marshalls/decodeVariant.js';
import { variantToBytes } from '../marshalls/encodeVariant.js';
import { UnportableUtility } from '../utility/unportableUtility.js';
import type { CastArgument } from '../utility/utilityArguments.js';
import { NIL, variant, type Variant, type VariantTypeName } from '../value/variant.js';
import { methodPort, type MethodParameter, type MethodPort } from './methodPort.js';
import { PACKED_BYTE_ARRAY_SHARED_METHODS } from './packedArrayMethods.js';

const int = (value: bigint | number): Variant => variant('INT', BigInt(value));
const text = (codes: readonly number[]): Variant => variant('STRING', textOf(codes));

const bytesOf = (base: Variant) => base.value as number[];
const viewOf = (bytes: readonly number[]) => new DataView(Uint8Array.from(bytes).buffer);

const port = (
  parameters: readonly MethodParameter[],
  body: (bytes: number[], args: readonly CastArgument[]) => Variant
) => methodPort(parameters, (base, args) => body(bytesOf(base), args));

const offsetAt = (args: readonly CastArgument[]) => Number(args[0] as bigint);
const fits = (bytes: readonly number[], offset: number, width: number) =>
  offset >= 0 && offset <= bytes.length - width;

/** `get_string_from_ascii` (variant_call.cpp:683): each byte as Latin-1, up to the first NUL. */
function asciiCodes(bytes: readonly number[]): number[] {
  const end = bytes.indexOf(0);
  return bytes.slice(0, end === -1 ? bytes.length : end);
}

/** `String::append_utf32` (ustring.cpp:185): a NUL, a surrogate or a code past U+10FFFF is U+FFFD. */
const utf32Codes = (units: readonly number[]): number[] =>
  units.map((unit) => (unit === 0 || (unit & 0xfffff800) === 0xd800 || unit > 0x10ffff ? REPLACEMENT : unit));

const isLead = (unit: number) => (unit & 0xfc00) === 0xd800;
const isTrail = (unit: number) => (unit & 0xfc00) === 0xdc00;

/** `String::append_utf16` (ustring.cpp:2014): a BOM picks the order, a NUL ends, a lone surrogate stays. */
function utf16Codes(units: readonly number[]): number[] {
  const hasBom = units[0] === 0xfeff || units[0] === 0xfffe;
  const isSwapped = units[0] === 0xfffe;
  const read = units
    .slice(hasBom ? 1 : 0)
    .map((unit) => (isSwapped ? ((unit & 0xff) << 8) | (unit >> 8) : unit));
  const end = read.indexOf(0);
  const run = read.slice(0, end === -1 ? read.length : end);
  // Godot counts a lead then a plain unit as two codes but writes one, so the last code is unset memory.
  if (
    run.some(
      (unit, index) =>
        isLead(unit) && index + 1 < run.length && !isLead(run[index + 1]!) && !isTrail(run[index + 1]!)
    )
  )
    throw new UnportableUtility(
      'get_string_from_utf16 of a lead surrogate before a plain unit, which reads unset memory'
    );
  const codes: number[] = [];
  for (let index = 0; index < run.length; index++) {
    const [unit, next] = [run[index]!, run[index + 1]];
    if (isLead(unit) && next !== undefined && isTrail(next)) {
      codes.push(((unit - 0xd800) << 10) + (next - 0xdc00) + 0x10000);
      index++;
    } else codes.push(unit);
  }
  return codes;
}

/** The whole little-endian units of `width` bytes, as `std::floor(size / width)` counts them. */
function unitsOf(bytes: readonly number[], width: 2 | 4): number[] {
  const view = viewOf(bytes);
  return Array.from({ length: Math.floor(bytes.length / width) }, (_, index) =>
    width === 2 ? view.getUint16(index * 2, true) : view.getUint32(index * 4, true)
  );
}

/** `String::hex_encode_buffer` (ustring.cpp:1640). */
const hexEncoded = (bytes: readonly number[]) =>
  bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');

type Reader = (view: DataView, offset: number) => Variant;

/** `func_PackedByteArray_decode_*` (variant_call.cpp:864): 0 where the value does not fit. */
function decoder(width: number, read: Reader, failed: Variant) {
  return port(['int64_t'], (bytes, args) => {
    const offset = offsetAt(args);
    return fits(bytes, offset, width) ? read(viewOf(bytes.slice(offset, offset + width)), 0) : failed;
  });
}

type Writer = (view: DataView, offset: number, value: CastArgument) => void;

/** `func_PackedByteArray_encode_*` (variant_call.cpp:1068): nothing where the value does not fit. */
function encoder(width: number, parameter: MethodParameter, write: Writer) {
  return port(['int64_t', parameter], (bytes, args) => {
    const offset = offsetAt(args);
    if (!fits(bytes, offset, width)) return NIL;
    const view = new DataView(new ArrayBuffer(width));
    write(view, 0, args[1]!);
    bytes.splice(offset, width, ...new Uint8Array(view.buffer));
    return NIL;
  });
}

// A signed and an unsigned store write the same low bytes of the int64 (variant_call.cpp:1068).
const writeLowBytes =
  (width: number): Writer =>
  (view, at, value) => {
    const bits = BigInt.asUintN(width * 8, value as bigint);
    for (let index = 0; index < width; index++)
      view.setUint8(at + index, Number((bits >> BigInt(8 * index)) & 0xffn));
  };

const ZERO = int(0);
const FLOAT_ZERO = variant('FLOAT', 0);

/** `func_PackedByteArray_bswap*` (variant_call.cpp:697): `count` -1 swaps every whole unit from `offset`. */
function byteSwap(width: number) {
  return port(['int64_t', 'int64_t'], (bytes, args) => {
    const [offset, wanted] = [offsetAt(args), Number(args[1] as bigint)];
    if (bytes.length === 0 || wanted === 0 || !fits(bytes, offset, width)) return NIL;
    const whole = Math.floor((bytes.length - offset) / width);
    const count = wanted < 0 ? whole : wanted;
    if (count > whole) return NIL;
    for (let unit = 0; unit < count; unit++) {
      const start = offset + unit * width;
      bytes.splice(start, width, ...bytes.slice(start, start + width).reverse());
    }
    return NIL;
  });
}

/** `func_PackedByteArray_decode_*_array` (variant_call.cpp:959): empty where the size is not whole units. */
function toArray(type: VariantTypeName, width: number, read: (view: DataView, offset: number) => unknown) {
  return port([], (bytes) => {
    if (bytes.length % width !== 0) return variant(type, [] as never) as Variant;
    const view = viewOf(bytes);
    const elements = Array.from({ length: bytes.length / width }, (_, index) => read(view, index * width));
    return variant(type, elements as never) as Variant;
  });
}

const f32 = (view: DataView, offset: number) => view.getFloat32(offset, true);
const vector2 = (view: DataView, at: number) => ({ x: f32(view, at), y: f32(view, at + 4) });
const vector3 = (view: DataView, at: number) => ({ ...vector2(view, at), z: f32(view, at + 8) });
const vector4 = (view: DataView, at: number) => ({ ...vector3(view, at), w: f32(view, at + 12) });
const color = (view: DataView, at: number) => {
  const { x: r, y: g, z: b, w: a } = vector4(view, at);
  return { r, g, b, a };
};

/** `has_encoded_var`, `decode_var` and `decode_var_size` (variant_call.cpp:904): a negative offset fails. */
function decodedVariant(bytes: readonly number[], args: readonly CastArgument[]) {
  const offset = offsetAt(args);
  if (offset < 0) return undefined;
  if (offset <= bytes.length) return decodedAt(bytes, offset, args[1] as boolean);
  // `decode_variant` reads the wrapped `size - p_offset` as an int: under 4 fails, more reads past the end.
  if (wrapInt32(BigInt(bytes.length) - (args[0] as bigint)) < 4) return undefined;
  throw new GodotCrash(`decode_variant at ${offset}, past an array of ${bytes.length} bytes`);
}

/** `func_PackedByteArray_encode_var` (variant_call.cpp:1135): the size written, or -1 if it does not fit. */
function encodeVar(bytes: number[], args: readonly CastArgument[]): Variant {
  const offset = offsetAt(args);
  if (offset < 0) return int(-1);
  const encoded = variantToBytes(args[1] as Variant, args[2] as boolean);
  if (offset + encoded.length > bytes.length) return int(-1);
  writeAt(bytes, offset, encoded);
  return int(encoded.length);
}

const machineDependent = (method: string) =>
  new UnportableUtility(`${method}, which converts with the iconv of the machine Godot runs on`);

export const PACKED_BYTE_ARRAY_METHODS: Readonly<Record<string, MethodPort>> = {
  ...PACKED_BYTE_ARRAY_SHARED_METHODS,
  get_string_from_ascii: port([], (bytes) => text(asciiCodes(bytes))),
  get_string_from_utf8: port([], (bytes) => text(utf8Codes(bytes))),
  get_string_from_utf16: port([], (bytes) => text(utf16Codes(unitsOf(bytes, 2)))),
  get_string_from_utf32: port([], (bytes) => text(utf32Codes(unitsOf(bytes, 4)))),
  // wchar_t is 32 bits on Linux and macOS (variant_call.cpp:777).
  get_string_from_wchar: port([], (bytes) => text(utf32Codes(unitsOf(bytes, 4)))),
  get_string_from_multibyte_char: port(['String'], (bytes) => {
    if (bytes.length > 0) throw machineDependent('get_string_from_multibyte_char');
    return text([]);
  }),
  hex_encode: port([], (bytes) => variant('STRING', hexEncoded(bytes))),
  decode_u8: decoder(1, (view, at) => int(view.getUint8(at)), ZERO),
  decode_s8: decoder(1, (view, at) => int(view.getInt8(at)), ZERO),
  decode_u16: decoder(2, (view, at) => int(view.getUint16(at, true)), ZERO),
  decode_s16: decoder(2, (view, at) => int(view.getInt16(at, true)), ZERO),
  decode_u32: decoder(4, (view, at) => int(view.getUint32(at, true)), ZERO),
  decode_s32: decoder(4, (view, at) => int(view.getInt32(at, true)), ZERO),
  decode_u64: decoder(8, (view, at) => int(view.getBigInt64(at, true)), ZERO),
  decode_s64: decoder(8, (view, at) => int(view.getBigInt64(at, true)), ZERO),
  decode_half: decoder(2, (view, at) => variant('FLOAT', halfToFloat(view.getUint16(at, true))), FLOAT_ZERO),
  decode_float: decoder(4, (view, at) => variant('FLOAT', f32(view, at)), FLOAT_ZERO),
  decode_double: decoder(8, (view, at) => variant('FLOAT', view.getFloat64(at, true)), FLOAT_ZERO),
  has_encoded_var: port(['int64_t', 'bool'], (bytes, args) =>
    variant('BOOL', decodedVariant(bytes, args) !== undefined)
  ),
  decode_var: port(['int64_t', 'bool'], (bytes, args) => decodedVariant(bytes, args)?.value ?? NIL),
  decode_var_size: port(['int64_t', 'bool'], (bytes, args) => int(decodedVariant(bytes, args)?.used ?? 0)),
  to_int32_array: toArray('PACKED_INT32_ARRAY', 4, (view, at) => view.getInt32(at, true)),
  to_int64_array: toArray('PACKED_INT64_ARRAY', 8, (view, at) => view.getBigInt64(at, true)),
  to_float32_array: toArray('PACKED_FLOAT32_ARRAY', 4, f32),
  to_float64_array: toArray('PACKED_FLOAT64_ARRAY', 8, (view, at) => view.getFloat64(at, true)),
  to_vector2_array: toArray('PACKED_VECTOR2_ARRAY', 8, vector2),
  to_vector3_array: toArray('PACKED_VECTOR3_ARRAY', 12, vector3),
  to_vector4_array: toArray('PACKED_VECTOR4_ARRAY', 16, vector4),
  to_color_array: toArray('PACKED_COLOR_ARRAY', 16, color),
  bswap16: byteSwap(2),
  bswap32: byteSwap(4),
  bswap64: byteSwap(8),
  encode_u8: encoder(1, 'int64_t', writeLowBytes(1)),
  encode_s8: encoder(1, 'int64_t', writeLowBytes(1)),
  encode_u16: encoder(2, 'int64_t', writeLowBytes(2)),
  encode_s16: encoder(2, 'int64_t', writeLowBytes(2)),
  encode_u32: encoder(4, 'int64_t', writeLowBytes(4)),
  encode_s32: encoder(4, 'int64_t', writeLowBytes(4)),
  encode_u64: encoder(8, 'int64_t', writeLowBytes(8)),
  encode_s64: encoder(8, 'int64_t', writeLowBytes(8)),
  encode_half: encoder(2, 'double', (view, at, value) =>
    view.setUint16(at, makeHalfFloat(value as number), true)
  ),
  encode_float: encoder(4, 'double', (view, at, value) => view.setFloat32(at, value as number, true)),
  encode_double: encoder(8, 'double', (view, at, value) => view.setFloat64(at, value as number, true)),
  encode_var: port(['int64_t', 'Variant', 'bool'], encodeVar),
};
