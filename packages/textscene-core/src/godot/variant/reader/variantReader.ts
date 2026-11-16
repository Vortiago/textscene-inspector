import { defaultValue } from '../value/defaultValue.js';
import { storedReal } from '../../math/real.js';
import { isAbsolutePath, simplifyPath } from '../../string/string.js';
import { transform3DOf } from '../../math/transform3d.js';
import { canInstantiate, classExists } from '../../classdb/classBaseTypes.js';
import { doubleToInt32, doubleToInt64, doubleToUint64, int64ToFloat32, wrapInt32 } from '../cInteger.js';
import { setEntry } from '../compare.js';
import { assignArray, assignDictionary } from '../construct/typedContainer.js';
import { castVariant } from '../construct/variantCast.js';
import {
  NIL,
  variant,
  type ContainerType,
  type DictionaryEntry,
  type Variant,
  type VariantOf,
} from '../value/variant.js';
import { stringify } from '../stringify.js';
import { VARIANT_TYPE, variantTypeName } from '../variantType.js';
import { makeObject, readUidCache } from '../objects/makeObject.js';
import { decodeMbedtlsBase64 } from './base64.js';
import { VariantTokenizer, type Token } from './variantTokenizer.js';

type NumberValue = VariantOf<'INT'> | VariantOf<'FLOAT'>;

/** A parse error, with the value `parse_value` had already stored when it found the error. */
class ParseFault extends Error {
  constructor(
    message: string,
    readonly partial: Variant = NIL
  ) {
    super(message);
  }
}

// variant_parser.cpp:1236: every type but NIL by its engine name.
const BUILTIN_TYPES = new Map(
  Object.values(VARIANT_TYPE)
    .filter((type) => type !== VARIANT_TYPE.NIL)
    .map((type) => [variantTypeName(type)!, type])
);

// `stor_fix` (variant_parser.cpp:149): the identifiers a number list takes as a float.
const NUMBER_IDENTIFIERS: Readonly<Record<string, number>> = {
  inf: Infinity,
  '-inf': -Infinity,
  inf_neg: -Infinity,
  nan: NaN,
};

// The C casts of `Variant::_to_int` and `_to_float` (variant.h:361) from a number token.
const asReal = (n: NumberValue) => (n.type === 'INT' ? int64ToFloat32(n.value) : storedReal(n.value));
const asDouble = (n: NumberValue) => (n.type === 'INT' ? Number(n.value) : n.value);
const asInt32 = (n: NumberValue) => (n.type === 'INT' ? wrapInt32(n.value) : doubleToInt32(n.value));
const asInt64 = (n: NumberValue) => (n.type === 'INT' ? n.value : doubleToInt64(n.value));
const asUint8 = (n: NumberValue) => asInt32(n) & 0xff;

function chunks<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.floor(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size)
  );
}

const xyzw = ([x, y, z, w]: readonly number[]) => ({ x: x!, y: y!, z: z!, w: w! });
const xyz = ([x, y, z]: readonly number[]) => ({ x: x!, y: y!, z: z! });
const xy = ([x, y]: readonly number[]) => ({ x: x!, y: y! });
const rgba = ([r, g, b, a]: readonly number[]) => ({ r: r!, g: g!, b: b!, a: a! });

/** A constructor of a fixed count of components, as `parse_value` builds each (variant_parser.cpp:707). */
interface Construct {
  readonly count: number;
  readonly component: (n: NumberValue) => number;
  readonly build: (components: readonly number[]) => Variant;
}

const real = (count: number, build: Construct['build']): Construct => ({ count, component: asReal, build });
const int32 = (count: number, build: Construct['build']): Construct => ({ count, component: asInt32, build });

const CONSTRUCTS: Readonly<Record<string, Construct>> = {
  Vector2: real(2, (c) => variant('VECTOR2', xy(c))),
  Vector2i: int32(2, (c) => variant('VECTOR2I', xy(c))),
  Rect2: real(4, ([x, y, w, h]) => variant('RECT2', { x: x!, y: y!, w: w!, h: h! })),
  Rect2i: int32(4, ([x, y, w, h]) => variant('RECT2I', { x: x!, y: y!, w: w!, h: h! })),
  Vector3: real(3, (c) => variant('VECTOR3', xyz(c))),
  Vector3i: int32(3, (c) => variant('VECTOR3I', xyz(c))),
  Vector4: real(4, (c) => variant('VECTOR4', xyzw(c))),
  Vector4i: int32(4, (c) => variant('VECTOR4I', xyzw(c))),
  Transform2D: real(6, ([a, b, c, d, tx, ty]) =>
    variant('TRANSFORM2D', { a: a!, b: b!, c: c!, d: d!, tx: tx!, ty: ty! })
  ),
  Plane: real(4, ([x, y, z, d]) => variant('PLANE', { normal: { x: x!, y: y!, z: z! }, d: d! })),
  Quaternion: real(4, (c) => variant('QUATERNION', xyzw(c))),
  AABB: real(6, (c) => variant('AABB', { position: xyz(c), size: xyz(c.slice(3)) })),
  Basis: real(9, (c) => variant('BASIS', c.slice(0, 9) as unknown as VariantOf<'BASIS'>['value'])),
  Transform3D: real(12, (c) =>
    variant(
      'TRANSFORM3D',
      transform3DOf(c.slice(0, 9) as unknown as VariantOf<'BASIS'>['value'], xyz(c.slice(9)))
    )
  ),
  Projection: real(16, (c) =>
    variant('PROJECTION', [xyzw(c), xyzw(c.slice(4)), xyzw(c.slice(8)), xyzw(c.slice(12))])
  ),
  Color: real(4, (c) => variant('COLOR', rgba(c))),
};

// The spellings older Godot versions wrote, read as the type of today.
const CONSTRUCT_ALIASES: Readonly<Record<string, string>> = {
  Matrix32: 'Transform2D',
  Quat: 'Quaternion',
  Rect3: 'AABB',
  Matrix3: 'Basis',
  Transform: 'Transform3D',
};

/** A packed array of numbers, read as `_parse_construct<T>` reads it (variant_parser.cpp:1427). */
interface PackedConstruct {
  readonly component: (n: NumberValue) => number | bigint;
  readonly build: (components: readonly (number | bigint)[]) => Variant;
}

const PACKED_CONSTRUCTS: Readonly<Record<string, PackedConstruct>> = {
  PackedInt32Array: { component: asInt32, build: (c) => variant('PACKED_INT32_ARRAY', c as number[]) },
  PackedInt64Array: { component: asInt64, build: (c) => variant('PACKED_INT64_ARRAY', c as bigint[]) },
  PackedFloat32Array: { component: asReal, build: (c) => variant('PACKED_FLOAT32_ARRAY', c as number[]) },
  PackedFloat64Array: { component: asDouble, build: (c) => variant('PACKED_FLOAT64_ARRAY', c as number[]) },
  PackedVector2Array: {
    component: asReal,
    build: (c) => variant('PACKED_VECTOR2_ARRAY', chunks(c as number[], 2).map(xy)),
  },
  PackedVector3Array: {
    component: asReal,
    build: (c) => variant('PACKED_VECTOR3_ARRAY', chunks(c as number[], 3).map(xyz)),
  },
  PackedVector4Array: {
    component: asReal,
    build: (c) => variant('PACKED_VECTOR4_ARRAY', chunks(c as number[], 4).map(xyzw)),
  },
  PackedColorArray: {
    component: asReal,
    build: (c) => variant('PACKED_COLOR_ARRAY', chunks(c as number[], 4).map(rgba)),
  },
};

const PACKED_ALIASES: Readonly<Record<string, string>> = {
  PackedIntArray: 'PackedInt32Array',
  PoolIntArray: 'PackedInt32Array',
  IntArray: 'PackedInt32Array',
  PackedRealArray: 'PackedFloat32Array',
  PoolRealArray: 'PackedFloat32Array',
  FloatArray: 'PackedFloat32Array',
  PoolVector2Array: 'PackedVector2Array',
  Vector2Array: 'PackedVector2Array',
  PoolVector3Array: 'PackedVector3Array',
  Vector3Array: 'PackedVector3Array',
  PoolVector4Array: 'PackedVector4Array',
  Vector4Array: 'PackedVector4Array',
  PoolColorArray: 'PackedColorArray',
  ColorArray: 'PackedColorArray',
};

const RESOURCE_CALLS = new Set(['Resource', 'SubResource', 'ExtResource']);
const BYTE_ARRAY_NAMES = new Set(['PackedByteArray', 'PoolByteArray', 'ByteArray']);
const STRING_ARRAY_NAMES = new Set(['PackedStringArray', 'PoolStringArray', 'StringArray']);

const KEYWORDS: Readonly<Record<string, Variant>> = {
  true: variant('BOOL', true),
  false: variant('BOOL', false),
  null: NIL,
  nil: NIL,
  inf: variant('FLOAT', Infinity),
  '-inf': variant('FLOAT', -Infinity),
  inf_neg: variant('FLOAT', -Infinity),
  nan: variant('FLOAT', NaN),
};

// `ResourceLoader::_validate_local_path` (resource_loader.cpp:505) for a path that is not a uid.
const localPath = (path: string): string => simplifyPath(isAbsolutePath(path) ? path : `res://${path}`);

// variant_parser.cpp:1141 reads any token as a text: one with no value keeps the value of the token before.
function tokenText(token: Token, previous: string): string {
  if (token.kind === 'string' || token.kind === 'string_name' || token.kind === 'identifier')
    return token.value;
  if (token.kind === 'number' || token.kind === 'color') return stringify(token.value);
  return previous;
}

/** `VariantParser::parse` (variant_parser.cpp:1918) with no resource parser, over one text. */
class VariantReader {
  readonly #tokens: VariantTokenizer;

  constructor(
    text: string,
    private readonly hasFile: (path: string) => boolean
  ) {
    this.#tokens = new VariantTokenizer(text);
  }

  next(): Token {
    return this.#tokens.next();
  }

  #expect(kind: Token['kind'], message: string, partial?: Variant): void {
    if (this.next().kind !== kind) throw new ParseFault(message, partial);
  }

  // Only the outermost value keeps what it stored before an error: a container drops its elements.
  #nested(token: Token): Variant {
    try {
      return this.value(token);
    } catch (error) {
      if (error instanceof ParseFault) throw new ParseFault(error.message);
      throw error;
    }
  }

  /** `parse_value` (variant_parser.cpp:676). */
  value(token: Token): Variant {
    switch (token.kind) {
      case '{':
        return variant('DICTIONARY', this.#dictionaryBody());
      case '[':
        return variant('ARRAY', this.#arrayBody());
      case 'identifier':
        return this.#identified(token.value);
      case 'number':
      case 'color':
        return token.value;
      case 'string':
        return variant('STRING', token.value);
      case 'string_name':
        return variant('STRING_NAME', token.value);
      default:
        throw new ParseFault(`Expected value, got '${token.kind}'`);
    }
  }

  #identified(id: string): Variant {
    const keyword = KEYWORDS[id];
    if (keyword) return keyword;
    const construct = CONSTRUCTS[CONSTRUCT_ALIASES[id] ?? id];
    if (construct) return this.#construct(construct);
    const packed = PACKED_CONSTRUCTS[PACKED_ALIASES[id] ?? id];
    if (packed) return packed.build(this.#numbers().map(packed.component));
    if (BYTE_ARRAY_NAMES.has(id)) return variant('PACKED_BYTE_ARRAY', this.#bytes());
    if (STRING_ARRAY_NAMES.has(id)) return variant('PACKED_STRING_ARRAY', this.#strings());
    switch (id) {
      case 'NodePath':
        return this.#nodePath();
      case 'RID':
        return this.#rid();
      case 'Signal':
        return this.#emptyCall(variant('SIGNAL', ''));
      case 'Callable':
        return this.#emptyCall(defaultValue('CALLABLE'));
      case 'Dictionary':
        return this.#typedDictionary();
      case 'Array':
        return this.#typedArray();
      case 'Object':
        return this.#object();
      default:
        if (RESOURCE_CALLS.has(id)) return this.#resource(id);
        throw new ParseFault(`Unexpected identifier '${id}'`);
    }
  }

  #construct({ count, component, build }: Construct): Variant {
    const components = this.#numbers().map(component);
    if (components.length !== count) throw new ParseFault(`Expected ${count} arguments for constructor`);
    return build(components);
  }

  // `_parse_construct` (variant_parser.cpp:556): no trailing comma, and `stor_fix` names among the numbers.
  #numbers(): NumberValue[] {
    this.#expect('(', "Expected '(' in constructor");
    const numbers: NumberValue[] = [];
    for (let token = this.next(); ;) {
      if (numbers.length === 0 && token.kind === ')') return numbers;
      numbers.push(this.#number(token, 'Expected float in constructor'));
      token = this.next();
      if (token.kind === ')') return numbers;
      if (token.kind !== ',') throw new ParseFault("Expected ',' or ')' in constructor");
      token = this.next();
    }
  }

  #number(token: Token, message: string): NumberValue {
    if (token.kind === 'number') return token.value;
    const named = token.kind === 'identifier' ? NUMBER_IDENTIFIERS[token.value] : undefined;
    if (named === undefined) throw new ParseFault(message);
    return variant('FLOAT', named);
  }

  /** `_parse_byte_array` (variant_parser.cpp:607): a base64 string or a list of numbers. */
  #bytes(): number[] {
    this.#expect('(', "Expected '(' in constructor");
    let token = this.next();
    if (token.kind === ')') return [];
    if (token.kind === 'string') {
      const bytes = decodeMbedtlsBase64(token.value);
      if (!bytes) throw new ParseFault('Invalid base64-encoded string');
      this.#expect(')', "Expected ')' in constructor");
      return [...bytes];
    }
    if (token.kind !== 'number' && token.kind !== 'identifier')
      throw new ParseFault('Expected base64 string, or list of numbers in constructor');
    const bytes: number[] = [];
    for (;;) {
      bytes.push(asUint8(this.#number(token, 'Expected number in constructor')));
      token = this.next();
      if (token.kind === ')') return bytes;
      if (token.kind !== ',') throw new ParseFault("Expected ',' or ')' in constructor");
      token = this.next();
    }
  }

  // variant_parser.cpp:1490: unlike a number list, a trailing comma before `)` is taken.
  #strings(): string[] {
    this.#expect('(', "Expected '('");
    const strings: string[] = [];
    for (;;) {
      if (strings.length > 0) {
        const separator = this.next();
        if (separator.kind === ')') return strings;
        if (separator.kind !== ',') throw new ParseFault("Expected ',' or ')'");
      }
      const token = this.next();
      if (token.kind === ')') return strings;
      if (token.kind !== 'string') throw new ParseFault('Expected string');
      strings.push(token.value);
    }
  }

  // NodePath, RID, Signal and Callable store the value before they read `)` (variant_parser.cpp:895-972).
  #nodePath(): Variant {
    this.#expect('(', "Expected '('");
    const token = this.next();
    if (token.kind !== 'string') throw new ParseFault('Expected string as argument for NodePath()');
    const path = castVariant(variant('STRING', token.value), 'NODE_PATH');
    this.#expect(')', "Expected ')'", path);
    return path;
  }

  #rid(): Variant {
    this.#expect('(', "Expected '('");
    const token = this.next();
    if (token.kind === ')') return variant('RID', 0n);
    if (token.kind !== 'number') throw new ParseFault("Expected number as argument or ')'");
    const id = token.value.type === 'INT' ? token.value.value : doubleToUint64(token.value.value);
    const rid = variant('RID', BigInt.asIntN(64, id));
    this.#expect(')', "Expected ')'", rid);
    return rid;
  }

  // variant_parser.cpp:994: the class check comes before the `,`, as Godot makes the object first.
  #object(): Variant {
    this.#expect('(', "Expected '('");
    const type = this.next();
    if (type.kind !== 'identifier') throw new ParseFault('Expected identifier with type of object');
    if (!canInstantiate(type.value))
      throw new ParseFault(`Can't instantiate Object() of type '${type.value}'`);
    this.#expect(',', "Expected ',' after object type");
    this.#objectProperties();
    return makeObject(`str_to_var of Object(${type.value}, ...)`);
  }

  // The properties parse before the object is used, so their faults still show.
  #objectProperties(): void {
    let needsComma = false;
    for (;;) {
      if (this.#tokens.isEof) throw new ParseFault('Unexpected EOF while parsing Object()');
      const token = this.next();
      if (token.kind === ')') return;
      if (needsComma) {
        if (token.kind !== ',') throw new ParseFault("Expected '}' or ','");
        needsComma = false;
        continue;
      }
      if (token.kind !== 'string') throw new ParseFault('Expected property name as string');
      this.#expect(':', "Expected ':'");
      if (this.#tokens.isEof) throw new ParseFault('Unexpected EOF while parsing Object()');
      this.#nested(this.next());
      needsComma = true;
    }
  }

  // variant_parser.cpp:1121, with no resource parser.
  #resource(id: string): Variant {
    this.#expect('(', "Expected '('");
    const first = this.next();
    if (first.kind !== 'string') throw new ParseFault('Expected string as argument for Resource()');
    let [path, uid] = first.value.startsWith('uid://') ? ['', first.value] : [first.value, ''];
    let token = this.next();
    if (token.kind === ',') {
      const extra = tokenText(this.next(), first.value);
      if (extra.startsWith('uid://')) {
        if (uid !== '') throw new ParseFault('Two uid:// paths in one Resource reference');
        uid = extra;
      } else {
        if (path !== '') throw new ParseFault('Two non-uid paths in one Resource reference');
        path = extra;
      }
      token = this.next();
    }
    const isFound = path !== '' && this.hasFile(localPath(path));
    if (!isFound && uid === '') throw new ParseFault(`Can't load resource at path: ${path} with uid: ${uid}`);
    if (token.kind !== ')') throw new ParseFault("Expected ')'");
    return isFound
      ? makeObject(`str_to_var of ${id}("${path}")`)
      : readUidCache(`str_to_var of ${id}("${uid}")`);
  }

  #emptyCall(empty: Variant): Variant {
    this.#expect('(', "Expected '('");
    this.#expect(')', "Expected ')'", empty);
    return empty;
  }

  /** The type a typed literal names, then `closer` (variant_parser.cpp:1236): an unknown class is untyped. */
  #containerType(message: string, closer: ',' | ']', closerMessage: string): ContainerType {
    const name = this.next();
    if (name.kind !== 'identifier') throw new ParseFault(message);
    // A bare `Resource` fails as a call on the `(` it expects, and the parser takes the closer found there.
    if (RESOURCE_CALLS.has(name.value)) {
      const after = this.next();
      if (name.value === 'Resource' && after.kind === closer)
        return { type: VARIANT_TYPE.OBJECT, className: 'Resource' };
      throw new ParseFault("Expected '('");
    }
    this.#expect(closer, closerMessage);
    const builtin = BUILTIN_TYPES.get(name.value);
    if (builtin !== undefined) return { type: builtin, className: '' };
    if (classExists(name.value)) return { type: VARIANT_TYPE.OBJECT, className: name.value };
    return { type: VARIANT_TYPE.NIL, className: '' };
  }

  #typedArray(): Variant {
    this.#expect('[', "Expected '['");
    const elementType = this.#containerType('Expected type identifier', ']', "Expected ']'");
    this.#expect('(', "Expected '('");
    this.#expect('[', "Expected '['");
    const elements = this.#arrayBody();
    this.#expect(')', "Expected ')'");
    return assignArray(variant('ARRAY', elements), elementType);
  }

  #typedDictionary(): Variant {
    this.#expect('[', "Expected '['");
    const keyType = this.#containerType(
      'Expected type identifier for key',
      ',',
      "Expected ',' after key type"
    );
    const valueType = this.#containerType('Expected type identifier for value', ']', "Expected ']'");
    this.#expect('(', "Expected '('");
    this.#expect('{', "Expected '{'");
    const entries = this.#dictionaryBody();
    this.#expect(')', "Expected ')'");
    return assignDictionary(variant('DICTIONARY', entries), keyType, valueType);
  }

  /** `_parse_array` (variant_parser.cpp:1650), after its `[`. */
  #arrayBody(): Variant[] {
    const elements: Variant[] = [];
    let needsComma = false;
    for (;;) {
      if (this.#tokens.isEof) throw new ParseFault('Unexpected EOF while parsing array');
      const token = this.next();
      if (token.kind === ']') return elements;
      if (needsComma) {
        if (token.kind !== ',') throw new ParseFault("Expected ','");
        needsComma = false;
        continue;
      }
      elements.push(this.#nested(token));
      needsComma = true;
    }
  }

  /** `_parse_dictionary` (variant_parser.cpp:1685), after its `{`. */
  #dictionaryBody(): DictionaryEntry[] {
    const entries: DictionaryEntry[] = [];
    let needsComma = false;
    for (;;) {
      if (this.#tokens.isEof) throw new ParseFault('Unexpected EOF while parsing dictionary');
      const token = this.next();
      if (token.kind === '}') return entries;
      if (needsComma) {
        if (token.kind !== ',') throw new ParseFault("Expected '}' or ','");
        needsComma = false;
        continue;
      }
      const key = this.#nested(token);
      this.#expect(':', "Expected ':'");
      if (this.#tokens.isEof) throw new ParseFault('Unexpected EOF while parsing dictionary');
      setEntry(entries, key, this.#nested(this.next()));
      needsComma = true;
    }
  }
}

/**
 * `str_to_var` (variant_utility.cpp:1044): what `VariantParser::parse` reads, or had stored before an error.
 *
 * @canonical The Variant str_to_var reads from a text
 */
export function textToVariant(text: string, hasFile: (path: string) => boolean = () => false): Variant {
  const reader = new VariantReader(text, hasFile);
  const first = reader.next();
  if (first.kind === 'error' || first.kind === 'eof') return NIL;
  try {
    return reader.value(first);
  } catch (error) {
    if (error instanceof ParseFault) return error.partial;
    throw error;
  }
}
