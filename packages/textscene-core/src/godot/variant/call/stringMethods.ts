import { hexBytes } from '../../crypto/blockHash.js';
import { md5 } from '../../crypto/md5.js';
import { sha1 } from '../../crypto/sha1.js';
import { sha256 } from '../../crypto/sha256.js';
import { isValidIpAddress } from '../../io/ipAddress.js';
import { stringHash } from '../../math/hashFuncs.js';
import { isUnicodeIdentifierContinue, isUnicodeIdentifierStart } from '../../string/characterClass.js';
import { findLower, findUpper } from '../../string/caseMapping.js';
import { hexDigitCodeValue, isValidAsciiIdentifier } from '../../string/charUtils.js';
import { cEscape, cUnescape, jsonEscape, xmlEscape } from '../../string/escapes.js';
import { doubleChars } from '../../string/grisu2.js';
import { validateNodeName } from '../../string/nodeName.js';
import { binToInt64, hexToInt64 } from '../../string/radixInteger.js';
import {
  getBaseDir,
  isAbsolutePath,
  pathJoin,
  simplifyPath,
  stringToInt64,
  validateFilename,
} from '../../string/string.js';
import {
  caseCompare,
  fileCaseCompare,
  fileNoCaseCompare,
  naturalCaseCompare,
  naturalNoCaseCompare,
  noCaseCompare,
} from '../../string/stringCompare.js';
import { stringNum } from '../../string/stringNumber.js';
import { stringToFloat } from '../../string/strtod.js';
import { codesOf, substr, textOf } from '../../string/ustring/codes.js';
import {
  capitalize,
  toCamelCase,
  toKebabCase,
  toPascalCase,
  toSnakeCase,
} from '../../string/ustring/compoundWords.js';
import {
  dedent,
  erase,
  indent,
  insert,
  left,
  leftStrip,
  removeCodes,
  repeat,
  replace,
  replaceCodes,
  right,
  rightStrip,
  stripEdges,
  stripEscapes,
} from '../../string/ustring/edit.js';
import {
  asciiBytes,
  REPLACEMENT,
  utf16Bytes,
  utf32Bytes,
  utf8Bytes,
  utf8Codes,
} from '../../string/ustring/encodings.js';
import { formatted } from '../../string/ustring/format.js';
import { padDecimals, padZeros } from '../../string/ustring/padding.js';
import {
  bigrams,
  count,
  find,
  isSubsequence,
  lowerCase,
  rfind,
  similarity,
  slice,
  sliceAtCode,
  sliceCount,
  unfolded,
} from '../../string/ustring/search.js';
import { floatRanges, join, rsplit, split } from '../../string/ustring/split.js';
import { isValidFloat, isValidHexNumber, isValidInt } from '../../string/ustring/validity.js';
import { wildcardMatch, wildcardMatchNoCase } from '../../string/wildcard.js';
import { xmlUnescape } from '../../string/xmlUnescape.js';
import type { CastArgument } from '../utility/utilityArguments.js';
import { UnportableUtility } from '../utility/unportableUtility.js';
import { variant, type Variant } from '../value/variant.js';
import { isHtmlValid } from './colorMethods.js';
import { methodPort, type MethodParameter, type MethodPort } from './methodPort.js';

const text = (value: string): Variant => variant('STRING', value);
const textOfCodes = (codes: readonly number[]): Variant => text(textOf(codes));
const int = (value: bigint | number): Variant => variant('INT', BigInt(value));
const bool = (value: boolean): Variant => variant('BOOL', value);
const bytes = (values: readonly number[] | Uint8Array): Variant =>
  variant('PACKED_BYTE_ARRAY', Array.from(values));
const texts = (pieces: readonly (readonly number[])[]): Variant =>
  variant(
    'PACKED_STRING_ARRAY',
    pieces.map((piece) => textOf(piece))
  );

const stringAt = (args: readonly CastArgument[], index: number) => args[index] as string;
const codesAt = (args: readonly CastArgument[], index: number) => codesOf(stringAt(args, index));
const numberAt = (args: readonly CastArgument[], index: number) => args[index] as number;
const flagAt = (args: readonly CastArgument[], index: number) => args[index] as boolean;

/** A StringName runs the String method on `String(*p_self)` (variant_call.cpp:1971). */
const onText = (
  parameters: readonly MethodParameter[],
  body: (self: string, args: readonly CastArgument[]) => Variant
) => methodPort(parameters, (base, args) => body(base.value as string, args));
const onCodes = (
  parameters: readonly MethodParameter[],
  body: (self: number[], args: readonly CastArgument[]) => Variant
) => onText(parameters, (self, args) => body(codesOf(self), args));
const staticPort = (
  parameters: readonly MethodParameter[],
  body: (args: readonly CastArgument[]) => Variant
) => methodPort(parameters, (_base, args) => body(args));

const compared = (compare: (a: string, b: string) => number) =>
  onText(['String'], (self, args) => int(compare(self, stringAt(args, 0))));

const startsWithCodes = (self: readonly number[], prefix: readonly number[]) =>
  prefix.length <= self.length && prefix.every((code, index) => self[index] === code);
const endsWithCodes = (self: readonly number[], suffix: readonly number[]) =>
  startsWithCodes(self.slice(self.length - suffix.length), suffix);

/** `rfind_char` of `/` or `\`, as `get_file`, `get_extension` and `get_basename` find the last separator. */
const lastSeparator = (self: string) => Math.max(self.lastIndexOf('/'), self.lastIndexOf('\\'));

/** The dot `get_extension` and `get_basename` split at (ustring.cpp:5037, 5136), or -1. */
function extensionDot(self: string): number {
  const dot = self.lastIndexOf('.');
  return dot < lastSeparator(self) ? -1 : dot;
}

const utf8Of = (self: string) => Uint8Array.from(utf8Bytes(codesOf(self)));

/** `String::hex_decode` (ustring.cpp:1657): empty for an odd length or a digit that is not hex. */
function hexDecoded(self: readonly number[]): number[] {
  const digits = self.map(hexDigitCodeValue);
  if (digits.length % 2 !== 0 || digits.includes(undefined)) return [];
  return Array.from(
    { length: digits.length / 2 },
    (_, index) => digits[2 * index]! * 16 + digits[2 * index + 1]!
  );
}

const isUriPlain = (byte: number) => /[A-Za-z0-9_.~-]/.test(String.fromCharCode(byte));

/** `String::uri_encode` (ustring.cpp:4395): each UTF-8 byte but `A-Z a-z 0-9 _ . - ~` as `%XX`. */
const uriEncoded = (self: string) =>
  utf8Bytes(codesOf(self))
    .map((byte) =>
      isUriPlain(byte) ? String.fromCharCode(byte) : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`
    )
    .join('');

/** A `%` digit `uri_decode` reads: a decimal digit or any ASCII capital, which `strtol` then stops at. */
const isUriDigit = (byte: number) => (byte >= 0x30 && byte <= 0x39) || (byte >= 0x41 && byte <= 0x5a);

/** `strtol(bytes, nullptr, 16)` of the two digits: the hex prefix of the pair, 0 when it has none. */
function hexPrefixValue(first: number, second: number): number {
  const prefix = /^[0-9A-F]*/.exec(String.fromCharCode(first, second))![0];
  return prefix === '' ? 0 : Number.parseInt(prefix, 16);
}

/** `uri_decode` and `uri_file_decode` (ustring.cpp:4413, 4438): only the first reads `+` as a space. */
function uriDecoded(self: string, isPlusSpace: boolean): number[] {
  const source = utf8Bytes(codesOf(self));
  const decoded: number[] = [];
  for (let at = 0; at < source.length; at++) {
    const byte = source[at]!;
    if (byte === 0x25 && at + 2 < source.length) {
      if (!isUriDigit(source[at + 1]!)) decoded.push(byte);
      else if (isUriDigit(source[at + 2]!)) {
        decoded.push(hexPrefixValue(source[at + 1]!, source[at + 2]!));
        at += 2;
      }
    } else decoded.push(isPlusSpace && byte === 0x2b ? 0x20 : byte);
  }
  return utf8Codes(decoded);
}

// String::is_valid_filename (ustring.cpp:4929): the characters validate_filename replaces.
const INVALID_FILENAME_CHARACTER = /[:/\\?*"|%<>]/;

function isValidFilename(self: string): boolean {
  const stripped = textOf(stripEdges(codesOf(self), true, true));
  return stripped === self && stripped !== '' && !INVALID_FILENAME_CHARACTER.test(stripped);
}

function isValidUnicodeIdentifier(self: string): boolean {
  const characters = Array.from(self);
  if (characters.length === 0 || !isUnicodeIdentifierStart(characters[0]!)) return false;
  return characters.slice(1).every(isUnicodeIdentifierContinue);
}

/** `String::num_int64` and `num_uint64` (ustring.cpp:1501, 1541): empty for a base outside 2 to 36. */
function numberInBase(value: bigint, base: number, isCapital: boolean): string {
  if (base < 2 || base > 36) return '';
  const digits = (value < 0n ? -value : value).toString(base);
  return (value < 0n ? '-' : '') + (isCapital ? digits.toUpperCase() : digits);
}

/** `String::chr` (ustring.h:445): NUL, a surrogate or a code past U+10FFFF becomes U+FFFD. */
const isScalar = (code: number) => code !== 0 && (code < 0xd800 || code > 0xdfff) && code <= 0x10ffff;

const HUMANIZED_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB'];

/** `String::humanize_size` (ustring.cpp:4248): `RTR` keeps each unit as it is in an English editor. */
function humanizedSize(size: bigint): string {
  let magnitude = 0;
  let divisor = 1n;
  while (size > divisor * 1024n && magnitude < 6) {
    divisor *= 1024n;
    magnitude++;
  }
  if (magnitude === 0) return `${size} B`;
  const whole = Number(BigInt.asIntN(32, size / divisor));
  const digits = whole < 100 ? 2 : whole < 1024 ? 1 : 0;
  const amount = padDecimals(codesOf(stringNum(Number(size) / Number(divisor))), digits);
  return `${textOf(amount)} ${HUMANIZED_UNITS[magnitude]}`;
}

/** `String::num_scientific(double)` (ustring.cpp:1618): `num(p_num, 0)` spells the values grisu2 cannot. */
const numScientific = (value: number) => (Number.isFinite(value) ? doubleChars(value) : stringNum(value, 0));

/** `String::rpad` and `lpad` (ustring.cpp:5162, 5172): `character` repeated up to `minimum` characters. */
function padding(self: readonly number[], args: readonly CastArgument[]): number[] {
  return repeat(codesAt(args, 1), (numberAt(args, 0) - self.length) | 0);
}

/** The String methods, bound on String and, but for the statics and `hash`, on StringName. */
const STRING_NAME_SHARED_METHODS = {
  casecmp_to: compared(caseCompare),
  nocasecmp_to: compared(noCaseCompare),
  naturalcasecmp_to: compared(naturalCaseCompare),
  naturalnocasecmp_to: compared(naturalNoCaseCompare),
  filecasecmp_to: compared(fileCaseCompare),
  filenocasecmp_to: compared(fileNoCaseCompare),
  length: onCodes([], (self) => int(self.length)),
  substr: onCodes(['int32_t', 'int32_t'], (self, args) =>
    textOfCodes(substr(self, numberAt(args, 0), numberAt(args, 1)))
  ),
  get_slice: onCodes(['String', 'int32_t'], (self, args) =>
    textOfCodes(slice(self, codesAt(args, 0), numberAt(args, 1)))
  ),
  get_slicec: onCodes(['uint32_t', 'int32_t'], (self, args) =>
    textOfCodes(sliceAtCode(self, numberAt(args, 0), numberAt(args, 1)))
  ),
  get_slice_count: onCodes(['String'], (self, args) => int(sliceCount(self, codesAt(args, 0)))),
  find: onCodes(['String', 'int32_t'], (self, args) => int(find(self, codesAt(args, 0), numberAt(args, 1)))),
  findn: onCodes(['String', 'int32_t'], (self, args) =>
    int(find(self, codesAt(args, 0), numberAt(args, 1), lowerCase))
  ),
  count: onCodes(['String', 'int32_t', 'int32_t'], (self, args) =>
    int(count(self, codesAt(args, 0), numberAt(args, 1), numberAt(args, 2), unfolded))
  ),
  countn: onCodes(['String', 'int32_t', 'int32_t'], (self, args) =>
    int(count(self, codesAt(args, 0), numberAt(args, 1), numberAt(args, 2), lowerCase))
  ),
  rfind: onCodes(['String', 'int32_t'], (self, args) =>
    int(rfind(self, codesAt(args, 0), numberAt(args, 1)))
  ),
  rfindn: onCodes(['String', 'int32_t'], (self, args) =>
    int(rfind(self, codesAt(args, 0), numberAt(args, 1), lowerCase))
  ),
  match: onText(['String'], (self, args) => bool(wildcardMatch(self, stringAt(args, 0)))),
  matchn: onText(['String'], (self, args) => bool(wildcardMatchNoCase(self, stringAt(args, 0)))),
  begins_with: onCodes(['String'], (self, args) => bool(startsWithCodes(self, codesAt(args, 0)))),
  ends_with: onCodes(['String'], (self, args) => bool(endsWithCodes(self, codesAt(args, 0)))),
  is_subsequence_of: onCodes(['String'], (self, args) =>
    bool(isSubsequence(self, codesAt(args, 0), unfolded))
  ),
  is_subsequence_ofn: onCodes(['String'], (self, args) =>
    bool(isSubsequence(self, codesAt(args, 0), lowerCase))
  ),
  bigrams: onCodes([], (self) => texts(bigrams(self))),
  similarity: onCodes(['String'], (self, args) => variant('FLOAT', similarity(self, codesAt(args, 0)))),
  format: onText(['Variant', 'String'], (self, args) =>
    text(formatted(self, args[0] as Variant, stringAt(args, 1)))
  ),
  replace: onCodes(['String', 'String'], (self, args) =>
    textOfCodes(replace(self, codesAt(args, 0), codesAt(args, 1), unfolded))
  ),
  replacen: onCodes(['String', 'String'], (self, args) =>
    textOfCodes(replace(self, codesAt(args, 0), codesAt(args, 1), lowerCase))
  ),
  replace_char: onCodes(['uint32_t', 'uint32_t'], (self, args) =>
    textOfCodes(replaceCodes(self, numberAt(args, 0) === 0 ? [] : [numberAt(args, 0)], numberAt(args, 1)))
  ),
  replace_chars: onCodes(['String', 'uint32_t'], (self, args) =>
    textOfCodes(replaceCodes(self, codesAt(args, 0), numberAt(args, 1)))
  ),
  remove_char: onCodes(['uint32_t'], (self, args) => textOfCodes(removeCodes(self, [numberAt(args, 0)]))),
  remove_chars: onCodes(['String'], (self, args) => textOfCodes(removeCodes(self, codesAt(args, 0)))),
  repeat: onCodes(['int32_t'], (self, args) => textOfCodes(repeat(self, numberAt(args, 0)))),
  reverse: onCodes([], (self) => textOfCodes(self.reverse())),
  insert: onCodes(['int32_t', 'String'], (self, args) =>
    textOfCodes(insert(self, numberAt(args, 0), codesAt(args, 1)))
  ),
  erase: onCodes(['int32_t', 'int32_t'], (self, args) =>
    textOfCodes(erase(self, numberAt(args, 0), numberAt(args, 1)))
  ),
  capitalize: onCodes([], (self) => textOfCodes(capitalize(self))),
  to_camel_case: onCodes([], (self) => textOfCodes(toCamelCase(self))),
  to_pascal_case: onCodes([], (self) => textOfCodes(toPascalCase(self))),
  to_snake_case: onCodes([], (self) => textOfCodes(toSnakeCase(self))),
  to_kebab_case: onCodes([], (self) => textOfCodes(toKebabCase(self))),
  split: onCodes(['String', 'bool', 'int32_t'], (self, args) =>
    texts(split(self, codesAt(args, 0), flagAt(args, 1), numberAt(args, 2)))
  ),
  rsplit: onCodes(['String', 'bool', 'int32_t'], (self, args) =>
    texts(rsplit(self, codesAt(args, 0), flagAt(args, 1), numberAt(args, 2)))
  ),
  split_floats: onCodes(['String', 'bool'], (self, args) =>
    variant(
      'PACKED_FLOAT64_ARRAY',
      floatRanges(self, codesAt(args, 0), flagAt(args, 1)).map(([from, end]) =>
        stringToFloat(textOf(self.slice(from, end)))
      )
    )
  ),
  join: onCodes(['PACKED_STRING_ARRAY'], (self, args) =>
    textOfCodes(join(self, ((args[0] as Variant).value as string[]).map(codesOf)))
  ),
  to_upper: onCodes([], (self) => textOfCodes(self.map(findUpper))),
  to_lower: onCodes([], (self) => textOfCodes(self.map(findLower))),
  left: onCodes(['int32_t'], (self, args) => textOfCodes(left(self, numberAt(args, 0)))),
  right: onCodes(['int32_t'], (self, args) => textOfCodes(right(self, numberAt(args, 0)))),
  strip_edges: onCodes(['bool', 'bool'], (self, args) =>
    textOfCodes(stripEdges(self, flagAt(args, 0), flagAt(args, 1)))
  ),
  strip_escapes: onCodes([], (self) => textOfCodes(stripEscapes(self))),
  lstrip: onCodes(['String'], (self, args) => textOfCodes(leftStrip(self, codesAt(args, 0)))),
  rstrip: onCodes(['String'], (self, args) => textOfCodes(rightStrip(self, codesAt(args, 0)))),
  get_extension: onText([], (self) => text(extensionDot(self) < 0 ? '' : self.slice(extensionDot(self) + 1))),
  get_basename: onText([], (self) => text(extensionDot(self) < 0 ? self : self.slice(0, extensionDot(self)))),
  path_join: onText(['String'], (self, args) => text(pathJoin(self, stringAt(args, 0)))),
  unicode_at: onCodes(['int32_t'], (self, args) => int(self[numberAt(args, 0)] ?? 0)),
  indent: onCodes(['String'], (self, args) => textOfCodes(indent(self, codesAt(args, 0)))),
  dedent: onCodes([], (self) => textOfCodes(dedent(self))),
  md5_text: onText([], (self) => text(hexBytes(md5([utf8Of(self)])))),
  sha1_text: onText([], (self) => text(hexBytes(sha1([utf8Of(self)])))),
  sha256_text: onText([], (self) => text(hexBytes(sha256([utf8Of(self)])))),
  md5_buffer: onText([], (self) => bytes(md5([utf8Of(self)]))),
  sha1_buffer: onText([], (self) => bytes(sha1([utf8Of(self)]))),
  sha256_buffer: onText([], (self) => bytes(sha256([utf8Of(self)]))),
  is_empty: onText([], (self) => bool(self === '')),
  contains: onCodes(['String'], (self, args) => bool(find(self, codesAt(args, 0)) !== -1)),
  containsn: onCodes(['String'], (self, args) => bool(find(self, codesAt(args, 0), 0, lowerCase) !== -1)),
  is_absolute_path: onText([], (self) => bool(isAbsolutePath(self))),
  is_relative_path: onText([], (self) => bool(!isAbsolutePath(self))),
  simplify_path: onText([], (self) => text(simplifyPath(self))),
  get_base_dir: onText([], (self) => text(getBaseDir(self))),
  get_file: onText([], (self) => text(self.slice(lastSeparator(self) + 1))),
  xml_escape: onText(['bool'], (self, args) => text(xmlEscape(self, flagAt(args, 0)))),
  xml_unescape: onText([], (self) => text(xmlUnescape(self))),
  uri_encode: onText([], (self) => text(uriEncoded(self))),
  uri_decode: onText([], (self) => textOfCodes(uriDecoded(self, true))),
  uri_file_decode: onText([], (self) => textOfCodes(uriDecoded(self, false))),
  c_escape: onText([], (self) => text(cEscape(self))),
  c_unescape: onText([], (self) => text(cUnescape(self))),
  json_escape: onText([], (self) => text(jsonEscape(self))),
  validate_node_name: onText([], (self) => text(validateNodeName(self))),
  validate_filename: onText([], (self) => text(validateFilename(self))),
  is_valid_ascii_identifier: onText([], (self) => bool(isValidAsciiIdentifier(self))),
  is_valid_unicode_identifier: onText([], (self) => bool(isValidUnicodeIdentifier(self))),
  is_valid_identifier: onText([], (self) => bool(isValidAsciiIdentifier(self))),
  is_valid_int: onCodes([], (self) => bool(isValidInt(self))),
  is_valid_float: onCodes([], (self) => bool(isValidFloat(self))),
  is_valid_hex_number: onCodes(['bool'], (self, args) => bool(isValidHexNumber(self, flagAt(args, 0)))),
  is_valid_html_color: onText([], (self) => bool(isHtmlValid(self))),
  is_valid_ip_address: onCodes([], (self) => bool(isValidIpAddress(self))),
  is_valid_filename: onText([], (self) => bool(isValidFilename(self))),
  to_int: onText([], (self) => int(stringToInt64(self))),
  to_float: onText([], (self) => variant('FLOAT', stringToFloat(self))),
  hex_to_int: onText([], (self) => int(hexToInt64(self))),
  bin_to_int: onText([], (self) => int(binToInt64(self))),
  lpad: onCodes(['int32_t', 'String'], (self, args) => textOfCodes([...padding(self, args), ...self])),
  rpad: onCodes(['int32_t', 'String'], (self, args) => textOfCodes([...self, ...padding(self, args)])),
  pad_decimals: onCodes(['int32_t'], (self, args) => textOfCodes(padDecimals(self, numberAt(args, 0)))),
  pad_zeros: onCodes(['int32_t'], (self, args) => textOfCodes(padZeros(self, numberAt(args, 0)))),
  trim_prefix: onCodes(['String'], (self, args) => {
    const prefix = codesAt(args, 0);
    return textOfCodes(startsWithCodes(self, prefix) ? self.slice(prefix.length) : self);
  }),
  trim_suffix: onCodes(['String'], (self, args) => {
    const suffix = codesAt(args, 0);
    return textOfCodes(endsWithCodes(self, suffix) ? self.slice(0, self.length - suffix.length) : self);
  }),
  to_ascii_buffer: onCodes([], (self) => bytes(asciiBytes(self))),
  to_utf8_buffer: onCodes([], (self) => bytes(utf8Bytes(self))),
  to_utf16_buffer: onCodes([], (self) => bytes(utf16Bytes(self))),
  to_utf32_buffer: onCodes([], (self) => bytes(utf32Bytes(self))),
  // wchar_t is 32 bits on Linux and macOS, so `to_wchar_buffer` is `to_utf32_buffer` (ustring.cpp:5646).
  to_wchar_buffer: onCodes([], (self) => bytes(utf32Bytes(self))),
  to_multibyte_char_buffer: onText(['String'], () => {
    throw new UnportableUtility(
      'to_multibyte_char_buffer, which converts with the iconv of the machine Godot runs on'
    );
  }),
  hex_decode: onCodes([], (self) => bytes(hexDecoded(self))),
} satisfies Record<string, MethodPort>;

export const STRING_NAME_METHODS: Readonly<Record<string, MethodPort>> = {
  ...STRING_NAME_SHARED_METHODS,
  hash: onText([], (self) => int(stringHash(self))),
};

export const STRING_METHODS: Readonly<Record<string, MethodPort>> = {
  ...STRING_NAME_METHODS,
  num_scientific: staticPort(['double'], (args) => text(numScientific(numberAt(args, 0)))),
  num: staticPort(['double', 'int32_t'], (args) => text(stringNum(numberAt(args, 0), numberAt(args, 1)))),
  num_int64: staticPort(['int64_t', 'int32_t', 'bool'], (args) =>
    text(numberInBase(args[0] as bigint, numberAt(args, 1), flagAt(args, 2)))
  ),
  num_uint64: staticPort(['uint64_t', 'int32_t', 'bool'], (args) =>
    text(numberInBase(args[0] as bigint, numberAt(args, 1), flagAt(args, 2)))
  ),
  chr: staticPort(['uint32_t'], (args) =>
    textOfCodes([isScalar(numberAt(args, 0)) ? numberAt(args, 0) : REPLACEMENT])
  ),
  humanize_size: staticPort(['uint64_t'], (args) => text(humanizedSize(args[0] as bigint))),
};
