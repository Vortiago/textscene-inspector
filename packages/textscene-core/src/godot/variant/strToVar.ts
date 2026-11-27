import { VARIANT_TYPE, variantTypeName } from './variantType.js';
import {
  COMPONENT_COUNTS,
  NIL_VALUE,
  type ComponentType,
  type ContainerType,
  type PackedNumberType,
  type ResourceReference,
  type VariantValue,
} from './variantValue.js';
import { DEFAULT_COLOR, htmlColor } from '../math/color.js';
import { GodotError, ParseError } from './parseError.js';

const T = VARIANT_TYPE;

type Token =
  | { kind: 'curlyOpen' | 'curlyClose' | 'bracketOpen' | 'bracketClose' | 'parenOpen' | 'parenClose' }
  | { kind: 'colon' | 'comma' | 'period' | 'equal' | 'eof' }
  | { kind: 'identifier'; text: string }
  | { kind: 'string' | 'stringName'; text: string }
  | { kind: 'number'; value: number; isFloat: boolean }
  | { kind: 'color'; value: readonly number[] }
  | { kind: 'error'; message: string };

/** A token `get_token` refuses: the reader sees a `TK_ERROR` token, and the message stays beside it. */
class TokenError extends Error {}

/** `VariantParser::tk_name`, the name a message gives each token (`variant_parser.cpp:129-147`). */
const TOKEN_NAMES: Readonly<Record<Token['kind'], string>> = {
  curlyOpen: "'{'",
  curlyClose: "'}'",
  bracketOpen: "'['",
  bracketClose: "']'",
  parenOpen: "'('",
  parenClose: "')'",
  identifier: 'identifier',
  string: 'string',
  stringName: 'string_name',
  number: 'number',
  color: 'color',
  colon: "':'",
  comma: "','",
  period: "'.'",
  equal: "'='",
  eof: 'EOF',
  error: 'ERROR',
};

const PUNCTUATION: Readonly<Record<string, Token['kind']>> = {
  '{': 'curlyOpen',
  '}': 'curlyClose',
  '[': 'bracketOpen',
  ']': 'bracketClose',
  '(': 'parenOpen',
  ')': 'parenClose',
  ':': 'colon',
  ',': 'comma',
  '.': 'period',
  '=': 'equal',
};

const ESCAPES: Readonly<Record<string, number>> = { b: 8, t: 9, n: 10, f: 12, r: 13 };

const isDigit = (c: string) => c >= '0' && c <= '9';
const isHexDigit = (c: string) => isDigit(c) || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
const isIdentifierStart = (c: string) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';

/** The int64 a `String::to_int` reads, clamped at the ends as Godot's overflow check returns them. */
function int64Of(text: string): number {
  const value = BigInt(text);
  const max = 2n ** 63n - 1n;
  const min = -(2n ** 63n);
  return Number(value > max ? max : value < min ? min : value);
}

/**
 * True when a string escapes the newline at `at`, so Godot's counter skips it (variant_parser.cpp:386).
 *
 * @canonical Whether a string escapes a newline
 */
export function isEscapedNewline(text: string, at: number): boolean {
  let backslashes = 0;
  while (text[at - 1 - backslashes] === '\\') backslashes++;
  return backslashes % 2 === 1;
}

/** One token at a time over `text` from `at`, as `get_token` reads a stream, counting lines as it does. */
export class Tokens {
  constructor(
    private readonly text: string,
    private at = 0,
    private lineAt = 1
  ) {}

  private startAt = 0;
  private startLine = 0;

  /** Where the last token read starts, and its line. */
  get tokenStart(): { readonly offset: number; readonly line: number } {
    return { offset: this.startAt, line: this.startLine };
  }

  /** The line Godot's counter stands on: a `\n` read as white space, in a comment or in a string counts. */
  get line(): number {
    return this.lineAt;
  }

  /** The offset of the next character to read. */
  get offset(): number {
    return this.at;
  }

  /** `Stream::is_eof`: true once a read has found the end, not when the last character is read. */
  get isEof(): boolean {
    return this.at > this.text.length;
  }

  private char(): string {
    return this.text[this.at++] ?? '';
  }

  next(): Token {
    try {
      return this.token();
    } catch (error) {
      if (error instanceof TokenError) return { kind: 'error', message: error.message };
      throw error;
    }
  }

  private token(): Token {
    for (;;) {
      this.startAt = this.at;
      this.startLine = this.lineAt;
      const c = this.char();
      // A NUL ends the stream for `get_token`, as the end of the text does (variant_parser.cpp:182).
      if (c === '' || c === '\0') return { kind: 'eof' };
      const punctuation = PUNCTUATION[c];
      if (punctuation) return { kind: punctuation } as Token;
      if (c === ';') {
        this.skipComment();
        continue;
      }
      if (c === '#') return this.color();
      if (c === '&' || c === '@') {
        if (this.char() !== '"') throw new TokenError(`Expected '"' after '&'`);
        return { kind: 'stringName', text: this.quoted() };
      }
      if (c === '"') return { kind: 'string', text: this.quoted() };
      if (c === '\n') this.lineAt++;
      if (c.charCodeAt(0) <= 32) continue;
      return this.word(c);
    }
  }

  private skipComment(): void {
    while (this.at < this.text.length) {
      if (this.char() !== '\n') continue;
      this.lineAt++;
      return;
    }
  }

  private color(): Token {
    let html = '';
    while (this.at < this.text.length && isHexDigit(this.text[this.at]!)) html += this.char();
    // A colour that runs to the end of the text reads as the end: `variant_parser.cpp:246-248`.
    if (this.at >= this.text.length) return { kind: 'eof' };
    if (this.text[this.at] === '\0') this.at++;
    const { r, g, b, a } = htmlColor(`#${html}`) ?? DEFAULT_COLOR;
    return { kind: 'color', value: [r, g, b, a].map(Math.fround) };
  }

  /** The body of a string after its opening quote, escapes read (`variant_parser.cpp:276-385`). */
  private quoted(): string {
    const plain = this.plainQuoted();
    if (plain !== null) return plain;
    let text = '';
    let lead = 0;
    for (;;) {
      const c = this.char();
      if (c === '' || c === '\0') throw new TokenError('Unterminated string');
      if (c === '"') break;
      if (c !== '\\') {
        if (lead) throw new TokenError('Invalid UTF-16 sequence in string, unpaired lead surrogate');
        // Only an unescaped newline counts (`variant_parser.cpp:387-389`).
        if (c === '\n') this.lineAt++;
        text += c;
        continue;
      }
      const code = this.escaped();
      if ((code & 0xfffffc00) === 0xd800) {
        if (lead) throw new TokenError('Invalid UTF-16 sequence in string, unpaired lead surrogate');
        lead = code;
        continue;
      }
      if ((code & 0xfffffc00) === 0xdc00) {
        if (!lead) throw new TokenError('Invalid UTF-16 sequence in string, unpaired trail surrogate');
        text += String.fromCodePoint((lead << 10) + code - ((0xd800 << 10) + 0xdc00 - 0x10000));
        lead = 0;
        continue;
      }
      if (lead) throw new TokenError('Invalid UTF-16 sequence in string, unpaired lead surrogate');
      text += String.fromCodePoint(code);
    }
    if (lead) throw new TokenError('Invalid UTF-16 sequence in string, unpaired lead surrogate');
    return text;
  }

  /** A string with no escape, sliced whole: most strings, read once per heading of every parse. */
  private plainQuoted(): string | null {
    const close = this.text.indexOf('"', this.at);
    if (close === -1) return null;
    const body = this.text.slice(this.at, close);
    if (body.includes('\\') || body.includes('\0')) return null;
    for (let at = body.indexOf('\n'); at !== -1; at = body.indexOf('\n', at + 1)) this.lineAt++;
    this.at = close + 1;
    return body;
  }

  private escaped(): number {
    const next = this.char();
    if (next === '' || next === '\0') throw new TokenError('Unterminated string');
    if (next !== 'u' && next !== 'U') return ESCAPES[next] ?? next.codePointAt(0)!;
    let code = 0;
    for (let i = 0; i < (next === 'U' ? 6 : 4); i++) {
      const digit = this.char();
      if (digit === '' || digit === '\0') throw new TokenError('Unterminated string');
      if (!isHexDigit(digit)) throw new TokenError('Malformed hex constant in string');
      code = code * 16 + Number.parseInt(digit, 16);
    }
    return code;
  }

  private word(first: string): Token {
    let text = '';
    let c = first;
    if (c === '-') {
      text = '-';
      c = this.char();
    }
    if (isDigit(c)) return this.number(text, c);
    if (!isIdentifierStart(c)) throw new TokenError('Unexpected character');
    while (isIdentifierStart(c) || (text.length > 0 && text !== '-' && isDigit(c))) {
      text += c;
      c = this.char();
    }
    this.unread(c);
    return { kind: 'identifier', text };
  }

  /** `variant_parser.cpp:412-482`. */
  private number(sign: string, first: string): Token {
    let text = sign;
    let c = first;
    let reading: 'int' | 'dec' | 'exp' = 'int';
    let isFloat = false;
    let hasExpSign = false;
    let hasExpDigit = false;
    for (;;) {
      if (reading === 'int' && !isDigit(c)) {
        if (c === '.') reading = 'dec';
        else if (c === 'e' || c === 'E') reading = 'exp';
        else break;
        isFloat = true;
      } else if (reading === 'dec' && !isDigit(c)) {
        if (c === 'e' || c === 'E') reading = 'exp';
        else break;
      } else if (reading === 'exp') {
        if (isDigit(c)) hasExpDigit = true;
        else if ((c === '-' || c === '+') && !hasExpSign && !hasExpDigit) hasExpSign = true;
        else break;
      }
      text += c;
      c = this.char();
    }
    this.unread(c);
    return { kind: 'number', value: isFloat ? Number.parseFloat(text) : int64Of(text), isFloat };
  }

  // `saved` holds no NUL (variant_parser.cpp:166), so a NUL that ends a word or a number is dropped.
  private unread(c: string): void {
    if (c !== '' && c !== '\0') this.at--;
  }
}

/** `stor_fix`: the identifiers a number slot reads as a number, or undefined. */
function namedNumber(text: string): number | undefined {
  if (text === 'inf') return Infinity;
  if (text === '-inf' || text === 'inf_neg') return -Infinity;
  if (text === 'nan') return NaN;
  return undefined;
}

/** How a constructor argument is stored: `real_t` and `float` are single precision. */
type Store = 'real' | 'int32' | 'int64' | 'uint8' | 'double';

/** `(int64_t)` of an infinity or a NaN is INT64_MIN on x86, whose low 32 and 8 bits are 0. */
function truncated(value: number): bigint {
  return Number.isFinite(value) ? BigInt(Math.trunc(value)) : 0n;
}

function stored(value: number, isFloat: boolean, store: Store): number {
  switch (store) {
    case 'real':
      return Math.fround(value);
    case 'double':
      return value;
    case 'int64':
      return isFloat ? Math.trunc(value) : value;
    case 'int32':
      return Number(BigInt.asIntN(32, truncated(value)));
    case 'uint8':
      return Number(BigInt.asUintN(8, truncated(value)));
  }
}

const COMPONENT_STORES: Readonly<Record<ComponentType, Store>> = {
  [T.VECTOR2]: 'real',
  [T.VECTOR2I]: 'int32',
  [T.RECT2]: 'real',
  [T.RECT2I]: 'int32',
  [T.VECTOR3]: 'real',
  [T.VECTOR3I]: 'int32',
  [T.TRANSFORM2D]: 'real',
  [T.VECTOR4]: 'real',
  [T.VECTOR4I]: 'int32',
  [T.PLANE]: 'real',
  [T.QUATERNION]: 'real',
  [T.AABB]: 'real',
  [T.BASIS]: 'real',
  [T.TRANSFORM3D]: 'real',
  [T.PROJECTION]: 'real',
  [T.COLOR]: 'real',
};

/** Each constructor name the parser reads, the compatibility spellings included. */
const COMPONENT_CONSTRUCTORS: Readonly<Record<string, ComponentType>> = {
  Vector2: T.VECTOR2,
  Vector2i: T.VECTOR2I,
  Rect2: T.RECT2,
  Rect2i: T.RECT2I,
  Vector3: T.VECTOR3,
  Vector3i: T.VECTOR3I,
  Vector4: T.VECTOR4,
  Vector4i: T.VECTOR4I,
  Transform2D: T.TRANSFORM2D,
  Matrix32: T.TRANSFORM2D,
  Plane: T.PLANE,
  Quaternion: T.QUATERNION,
  Quat: T.QUATERNION,
  AABB: T.AABB,
  Rect3: T.AABB,
  Basis: T.BASIS,
  Matrix3: T.BASIS,
  Transform3D: T.TRANSFORM3D,
  Transform: T.TRANSFORM3D,
  Projection: T.PROJECTION,
  Color: T.COLOR,
};

const PACKED_CONSTRUCTORS: Readonly<Record<string, { type: PackedNumberType; store: Store }>> = {
  PackedInt32Array: { type: T.PACKED_INT32_ARRAY, store: 'int32' },
  PackedIntArray: { type: T.PACKED_INT32_ARRAY, store: 'int32' },
  PoolIntArray: { type: T.PACKED_INT32_ARRAY, store: 'int32' },
  IntArray: { type: T.PACKED_INT32_ARRAY, store: 'int32' },
  PackedInt64Array: { type: T.PACKED_INT64_ARRAY, store: 'int64' },
  PackedFloat32Array: { type: T.PACKED_FLOAT32_ARRAY, store: 'real' },
  PackedRealArray: { type: T.PACKED_FLOAT32_ARRAY, store: 'real' },
  PoolRealArray: { type: T.PACKED_FLOAT32_ARRAY, store: 'real' },
  FloatArray: { type: T.PACKED_FLOAT32_ARRAY, store: 'real' },
  PackedFloat64Array: { type: T.PACKED_FLOAT64_ARRAY, store: 'double' },
  PackedVector2Array: { type: T.PACKED_VECTOR2_ARRAY, store: 'real' },
  PoolVector2Array: { type: T.PACKED_VECTOR2_ARRAY, store: 'real' },
  Vector2Array: { type: T.PACKED_VECTOR2_ARRAY, store: 'real' },
  PackedVector3Array: { type: T.PACKED_VECTOR3_ARRAY, store: 'real' },
  PoolVector3Array: { type: T.PACKED_VECTOR3_ARRAY, store: 'real' },
  Vector3Array: { type: T.PACKED_VECTOR3_ARRAY, store: 'real' },
  PackedVector4Array: { type: T.PACKED_VECTOR4_ARRAY, store: 'real' },
  PoolVector4Array: { type: T.PACKED_VECTOR4_ARRAY, store: 'real' },
  Vector4Array: { type: T.PACKED_VECTOR4_ARRAY, store: 'real' },
  PackedColorArray: { type: T.PACKED_COLOR_ARRAY, store: 'real' },
  PoolColorArray: { type: T.PACKED_COLOR_ARRAY, store: 'real' },
  ColorArray: { type: T.PACKED_COLOR_ARRAY, store: 'real' },
};

const BYTE_ARRAY_NAMES = new Set(['PackedByteArray', 'PoolByteArray', 'ByteArray']);
const STRING_ARRAY_NAMES = new Set(['PackedStringArray', 'PoolStringArray', 'StringArray']);

/** The builtin types a typed container names, Nil left out: `variant_parser.cpp:1245-1250`. */
const BUILTIN_TYPES: ReadonlyMap<string, number> = new Map(
  Object.values(VARIANT_TYPE)
    .filter((type) => type !== T.NIL)
    .map((type) => [variantTypeName(type)!, type])
);

/** What the reader asks its caller: which classes exist, and the file a resource id names. */
export interface VariantReading {
  /** Every class exists where it is absent. */
  readonly classExists?: (className: string) => boolean;
  /** The file an `ExtResource` or a `SubResource` id names. Absent reads the id as a path. */
  readonly resourceOf?: (kind: 'ExtResource' | 'SubResource', id: string) => ResourceReference | null;
}

export class ValueReader {
  private readonly classExists: (className: string) => boolean;

  constructor(
    private readonly tokens: Tokens,
    private readonly reading: VariantReading
  ) {
    this.classExists = reading.classExists ?? (() => true);
  }

  private expect(kind: Token['kind'], message: string): Token {
    const token = this.tokens.next();
    if (token.kind !== kind) throw new ParseError(message);
    return token;
  }

  value(token: Token): VariantValue {
    switch (token.kind) {
      case 'curlyOpen':
        return { type: T.DICTIONARY, entries: this.dictionaryBody() };
      case 'bracketOpen':
        return { type: T.ARRAY, elements: this.arrayBody() };
      case 'identifier':
        return this.identified(token.text);
      case 'number':
        return { type: token.isFloat ? T.FLOAT : T.INT, value: token.value };
      case 'string':
        return { type: T.STRING, value: token.text };
      case 'stringName':
        return { type: T.STRING_NAME, value: token.text };
      case 'color':
        return { type: T.COLOR, value: token.value };
      default:
        throw new ParseError(`Expected value, got '${TOKEN_NAMES[token.kind]}'`);
    }
  }

  private identified(id: string): VariantValue {
    if (id === 'true' || id === 'false') return { type: T.BOOL, value: id === 'true' };
    if (id === 'null' || id === 'nil') return NIL_VALUE;
    const named = namedNumber(id);
    if (named !== undefined) return { type: T.FLOAT, value: named };
    const component = COMPONENT_CONSTRUCTORS[id];
    if (component !== undefined) return this.components(component);
    const packed = PACKED_CONSTRUCTORS[id];
    if (packed)
      return { type: packed.type, value: this.numbers(packed.store, 'Expected float in constructor') };
    if (BYTE_ARRAY_NAMES.has(id)) return { type: T.PACKED_BYTE_ARRAY, value: this.bytes() };
    if (STRING_ARRAY_NAMES.has(id)) return { type: T.PACKED_STRING_ARRAY, value: this.strings() };
    switch (id) {
      case 'NodePath':
        return { type: T.NODE_PATH, value: this.oneString('Expected string as argument for NodePath()') };
      case 'RID':
        return this.rid();
      case 'Signal':
      case 'Callable':
        this.expect('parenOpen', "Expected '('");
        this.expect('parenClose', "Expected ')'");
        return { type: id === 'Signal' ? T.SIGNAL : T.CALLABLE };
      case 'Object':
        return this.object();
      case 'SubResource':
      case 'ExtResource':
        return this.reading.resourceOf ? this.parsedResource(id) : this.resource();
      case 'Resource':
        return this.resource();
      case 'Dictionary':
        return this.typedDictionary();
      case 'Array':
        return this.typedArray();
    }
    throw new ParseError(`Unexpected identifier '${id}'`);
  }

  private components(type: ComponentType): VariantValue {
    const value = this.numbers(COMPONENT_STORES[type], 'Expected float in constructor');
    const count = COMPONENT_COUNTS[type];
    if (value.length !== count) throw new ParseError(`Expected ${count} arguments for constructor`);
    return { type, value };
  }

  /** `_parse_construct`: numbers in parentheses, `inf` and `nan` among them. */
  private numbers(store: Store, message: string): number[] {
    this.expect('parenOpen', "Expected '(' in constructor");
    const numbers: number[] = [];
    for (let first = true; ; first = false) {
      if (!first) {
        const separator = this.tokens.next();
        if (separator.kind === 'parenClose') break;
        if (separator.kind !== 'comma') throw new ParseError("Expected ',' or ')' in constructor");
      }
      const token = this.tokens.next();
      if (first && token.kind === 'parenClose') break;
      numbers.push(this.number(token, store, message));
    }
    return numbers;
  }

  private number(token: Token, store: Store, message: string): number {
    if (token.kind === 'number') return stored(token.value, token.isFloat, store);
    const named = token.kind === 'identifier' ? namedNumber(token.text) : undefined;
    if (named === undefined) throw new ParseError(message);
    return stored(named, true, store);
  }

  /** `_parse_byte_array`: a base64 string, or a list of numbers (`variant_parser.cpp:592-674`). */
  private bytes(): number[] {
    this.expect('parenOpen', "Expected '(' in constructor");
    let token = this.tokens.next();
    if (token.kind === 'parenClose') return [];
    if (token.kind === 'string') {
      const bytes = base64Bytes(token.text);
      this.expect('parenClose', "Expected ')' in constructor");
      return bytes;
    }
    if (token.kind !== 'number' && token.kind !== 'identifier')
      throw new ParseError('Expected base64 string, or list of numbers in constructor');
    const bytes: number[] = [];
    for (;;) {
      bytes.push(this.number(token, 'uint8', 'Expected number in constructor'));
      const separator = this.tokens.next();
      if (separator.kind === 'parenClose') return bytes;
      if (separator.kind !== 'comma') throw new ParseError("Expected ',' or ')' in constructor");
      token = this.tokens.next();
    }
  }

  private strings(): string[] {
    this.expect('parenOpen', "Expected '('");
    const strings: string[] = [];
    for (let first = true; ; first = false) {
      if (!first) {
        const separator = this.tokens.next();
        if (separator.kind === 'parenClose') break;
        if (separator.kind !== 'comma') throw new ParseError("Expected ',' or ')'");
      }
      const token = this.tokens.next();
      if (token.kind === 'parenClose') break;
      if (token.kind !== 'string') throw new ParseError('Expected string');
      strings.push(token.text);
    }
    return strings;
  }

  private oneString(message: string): string {
    this.expect('parenOpen', "Expected '('");
    const token = this.tokens.next();
    if (token.kind !== 'string') throw new ParseError(message);
    this.expect('parenClose', "Expected ')'");
    return token.text;
  }

  private rid(): VariantValue {
    this.expect('parenOpen', "Expected '('");
    const token = this.tokens.next();
    if (token.kind === 'parenClose') return { type: T.RID, value: 0 };
    if (token.kind !== 'number') throw new ParseError("Expected number as argument or ')'");
    this.expect('parenClose', "Expected ')'");
    return { type: T.RID, value: Math.trunc(token.value) };
  }

  /** `Object(Class, "property": value, …)` (`variant_parser.cpp:1005-1094`). */
  private object(): VariantValue {
    this.expect('parenOpen', "Expected '('");
    const type = this.tokens.next();
    if (type.kind !== 'identifier') throw new ParseError('Expected identifier with type of object');
    if (!this.classExists(type.text))
      throw new ParseError(`Can't instantiate Object() of type '${type.text}'`);
    this.expect('comma', "Expected ',' after object type");
    const properties: [string, VariantValue][] = [];
    for (let needsComma = false; ;) {
      const token = this.containerToken('Object()');
      if (token.kind === 'parenClose') return { type: T.OBJECT, className: type.text, properties };
      if (needsComma) {
        if (token.kind !== 'comma') throw new ParseError("Expected '}' or ','");
        needsComma = false;
        continue;
      }
      if (token.kind !== 'string') throw new ParseError('Expected property name as string');
      this.expectChecked('colon', "Expected ':'");
      properties.push([token.text, this.value(this.checkedToken())]);
      needsComma = true;
    }
  }

  /** Godot loads the file here (`variant_parser.cpp:1131-1189`). This keeps the reference to load later. */
  private resource(): VariantValue {
    this.expect('parenOpen', "Expected '('");
    const first = this.tokens.next();
    if (first.kind !== 'string') throw new ParseError('Expected string as argument for Resource()');
    let path = first.text;
    let uid = '';
    if (path.startsWith('uid://')) {
      uid = path;
      path = '';
    }
    let token = this.tokens.next();
    if (token.kind === 'comma') {
      const extra = this.tokens.next();
      if (extra.kind !== 'string') throw new ParseError('Expected string in Resource reference');
      if (extra.text.startsWith('uid://')) {
        if (uid) throw new ParseError('Two uid:// paths in one Resource reference');
        uid = extra.text;
      } else {
        if (path) throw new ParseError('Two non-uid paths in one Resource reference');
        path = extra.text;
      }
      token = this.tokens.next();
    }
    if (!path) throw new ParseError(`Can't load resource at path:  with uid: ${uid}`);
    if (token.kind !== 'parenClose') throw new ParseError("Expected ')'");
    return { type: T.OBJECT, resource: uid ? { path, uid } : { path } };
  }

  /** `ext_func` and `sub_func` (`variant_parser.cpp:1104-1124`): an id the file declares, or null. */
  private parsedResource(kind: 'ExtResource' | 'SubResource'): VariantValue {
    this.expect('parenOpen', "Expected '('");
    const id = this.tokens.next();
    const text = id.kind === 'string' ? id.text : id.kind === 'number' ? String(id.value) : null;
    if (text === null) throw new ParseError(`Expected string or number as ${kind} id`);
    this.expect('parenClose', "Expected ')'");
    const resource = this.reading.resourceOf!(kind, text);
    return resource ? { type: T.OBJECT, resource } : NIL_VALUE;
  }

  /** `variant_parser.cpp:1252-1287`. */
  private containerType(): ContainerType | undefined {
    const token = this.tokens.next();
    if (token.kind !== 'identifier') throw new ParseError('Expected type identifier');
    const builtin = BUILTIN_TYPES.get(token.text);
    if (builtin !== undefined) return { builtin };
    return this.classExists(token.text) ? { className: token.text } : undefined;
  }

  private typedArray(): VariantValue {
    this.expect('bracketOpen', "Expected '['");
    const elementType = this.containerType();
    this.expect('bracketClose', "Expected ']'");
    this.expect('parenOpen', "Expected '('");
    this.expect('bracketOpen', "Expected '['");
    const elements = this.arrayBody();
    this.expect('parenClose', "Expected ')'");
    return elementType ? { type: T.ARRAY, elements, elementType } : { type: T.ARRAY, elements };
  }

  private typedDictionary(): VariantValue {
    this.expect('bracketOpen', "Expected '['");
    const keyType = this.containerType();
    this.expect('comma', "Expected ',' after key type");
    const valueType = this.containerType();
    this.expect('bracketClose', "Expected ']'");
    this.expect('parenOpen', "Expected '('");
    this.expect('curlyOpen', "Expected '{'");
    const entries = this.dictionaryBody();
    this.expect('parenClose', "Expected ')'");
    return {
      type: T.DICTIONARY,
      entries,
      ...(keyType ? { keyType } : {}),
      ...(valueType ? { valueType } : {}),
    };
  }

  private arrayBody(): VariantValue[] {
    const elements: VariantValue[] = [];
    for (let needsComma = false; ;) {
      const token = this.containerToken('array');
      if (token.kind === 'bracketClose') return elements;
      if (needsComma) {
        if (token.kind !== 'comma') throw new ParseError("Expected ','");
        needsComma = false;
        continue;
      }
      elements.push(this.value(token));
      needsComma = true;
    }
  }

  /** The entries in source order, a repeated key kept as written: the reader of the entries settles it. */
  private dictionaryBody(): [VariantValue, VariantValue][] {
    const entries: [VariantValue, VariantValue][] = [];
    for (let needsComma = false; ;) {
      const token = this.containerToken('dictionary');
      if (token.kind === 'curlyClose') return entries;
      if (needsComma) {
        if (token.kind !== 'comma') throw new ParseError("Expected '}' or ','");
        needsComma = false;
        continue;
      }
      const key = this.value(token);
      this.expectChecked('colon', "Expected ':'");
      entries.push([key, this.value(this.checkedToken())]);
      needsComma = true;
    }
  }

  /** `is_eof` before the read (variant_parser.cpp:1647): `[1, "a"` ends on a missing `,`, `[1, 2` on EOF. */
  private containerToken(container: string): Token {
    if (this.tokens.isEof)
      throw new ParseError(`Unexpected EOF while parsing ${container}`, GodotError.FileCorrupt);
    return this.checkedToken();
  }

  /** For a caller that returns `get_token`'s `Error`: a refused token stops with its own message. */
  private checkedToken(): Token {
    const token = this.tokens.next();
    if (token.kind === 'error') throw new ParseError(token.message);
    return token;
  }

  private expectChecked(kind: Token['kind'], message: string): void {
    if (this.checkedToken().kind !== kind) throw new ParseError(message);
  }
}

function base64Bytes(text: string): number[] {
  try {
    return [...atob(text)].map((c) => c.charCodeAt(0));
  } catch {
    throw new ParseError('Invalid base64-encoded string');
  }
}

/** A value read from `text`, or the message Godot's parser stops with. */
export type VariantRead = { readonly value: VariantValue } | { readonly error: string };

/** `VariantParser::parse`: the first value, the rest unread. */
export function readVariant(text: string, reading: VariantReading = {}): VariantRead {
  const tokens = new Tokens(text);
  const first = tokens.next();
  // `parse` returns `get_token`'s own error, so `"abc` stops with `Unterminated string`.
  if (first.kind === 'error') return { error: first.message };
  try {
    return { value: new ValueReader(tokens, reading).value(first) };
  } catch (error) {
    if (error instanceof ParseError) return { error: error.message };
    throw error;
  }
}

/** `str_to_var`: the value, or null (Nil) where the text does not parse. */
export function strToVar(text: string, reading?: VariantReading): VariantValue {
  const read = readVariant(text, reading);
  return 'value' in read ? read.value : NIL_VALUE;
}
