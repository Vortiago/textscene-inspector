const INTS = [
  '0',
  '1',
  '-1',
  '2',
  '3',
  '7',
  '-7',
  '63',
  '64',
  '65',
  '2147483647',
  '(-2147483648)',
  '9223372036854775807',
  '(-9223372036854775807 - 1)',
  '0x7f',
  '0b101',
];
const FLOATS = [
  '0.0',
  '(-0.0)',
  '0.5',
  '(-2.5)',
  '1.0',
  '3.14159',
  '1e300',
  '(-1e-310)',
  '0.1',
  '100.25',
  'INF',
  '(-INF)',
  'NAN',
];
const FINITE_FLOATS = FLOATS.filter((text) => !/INF|NAN|e300|e-310/.test(text));
const SMALL_INTS = ['0', '1', '-1', '2', '3', '-5', '7', '100', '2147483647', '(-2147483648)'];
const STRINGS = ['""', '"abc"', '"Abc"', '"%s and %d"', '"%.2f"', '"é"', '"a\\tb"', '"10"'];

const component = (random) => random.pick(random.chance(0.9) ? FINITE_FLOATS : FLOATS);
const components = (random, count) => Array.from({ length: count }, () => component(random));
const smallInts = (random, count) => Array.from({ length: count }, () => random.pick(SMALL_INTS));
const call = (name, parts) => `${name}(${parts.join(', ')})`;

const vector2 = (random) => call('Vector2', components(random, 2));
const vector3 = (random) => call('Vector3', components(random, 3));
const vector4 = (random) => call('Vector4', components(random, 4));

/** A text of an element for an Array, a Dictionary or an `in` test: a scalar or a short string. */
function elementText(random) {
  return random.pick([
    () => random.pick(SMALL_INTS),
    () => random.pick(FINITE_FLOATS),
    () => random.pick(STRINGS),
    () => 'null',
    () => 'true',
  ])();
}

const list = (random, make) => Array.from({ length: random.below(4) }, () => make(random));

const BUILDERS = {
  NIL: () => 'null',
  BOOL: (random) => random.pick(['true', 'false']),
  INT: (random) => random.pick(INTS),
  FLOAT: (random) => random.pick(FLOATS),
  STRING: (random) => random.pick(STRINGS),
  VECTOR2: vector2,
  VECTOR2I: (random) => call('Vector2i', smallInts(random, 2)),
  RECT2: (random) => call('Rect2', components(random, 4)),
  RECT2I: (random) => call('Rect2i', smallInts(random, 4)),
  VECTOR3: vector3,
  VECTOR3I: (random) => call('Vector3i', smallInts(random, 3)),
  TRANSFORM2D: (random) => call('Transform2D', [vector2(random), vector2(random), vector2(random)]),
  VECTOR4: vector4,
  VECTOR4I: (random) => call('Vector4i', smallInts(random, 4)),
  PLANE: (random) => call('Plane', components(random, 4)),
  QUATERNION: (random) => call('Quaternion', components(random, 4)),
  AABB: (random) => call('AABB', [vector3(random), vector3(random)]),
  BASIS: (random) => call('Basis', [vector3(random), vector3(random), vector3(random)]),
  TRANSFORM3D: (random) =>
    call('Transform3D', [
      call('Basis', [vector3(random), vector3(random), vector3(random)]),
      vector3(random),
    ]),
  PROJECTION: (random) =>
    call('Projection', [vector4(random), vector4(random), vector4(random), vector4(random)]),
  COLOR: (random) => call('Color', components(random, 4)),
  STRING_NAME: (random) => call('StringName', [random.pick(STRINGS)]),
  NODE_PATH: (random) => call('NodePath', [random.pick(['"a/b:c"', '""', '"/root"', '"x"'])]),
  RID: () => 'RID()',
  OBJECT: () => 'Object()',
  CALLABLE: () => 'Callable()',
  SIGNAL: () => 'Signal()',
  DICTIONARY: (random) => `{${list(random, (r) => `${elementText(r)}: ${elementText(r)}`).join(', ')}}`,
  ARRAY: (random) => `[${list(random, elementText).join(', ')}]`,
  PACKED_BYTE_ARRAY: (random) =>
    call('PackedByteArray', [`[${smallInts(random, random.below(4)).join(', ')}]`]),
  PACKED_INT32_ARRAY: (random) =>
    call('PackedInt32Array', [`[${smallInts(random, random.below(4)).join(', ')}]`]),
  PACKED_INT64_ARRAY: (random) =>
    call('PackedInt64Array', [`[${list(random, (r) => r.pick(INTS)).join(', ')}]`]),
  PACKED_FLOAT32_ARRAY: (random) =>
    call('PackedFloat32Array', [`[${components(random, random.below(4)).join(', ')}]`]),
  PACKED_FLOAT64_ARRAY: (random) =>
    call('PackedFloat64Array', [`[${list(random, (r) => r.pick(FLOATS)).join(', ')}]`]),
  PACKED_STRING_ARRAY: (random) =>
    call('PackedStringArray', [`[${list(random, (r) => r.pick(STRINGS)).join(', ')}]`]),
  PACKED_VECTOR2_ARRAY: (random) => call('PackedVector2Array', [`[${list(random, vector2).join(', ')}]`]),
  PACKED_VECTOR3_ARRAY: (random) => call('PackedVector3Array', [`[${list(random, vector3).join(', ')}]`]),
  PACKED_COLOR_ARRAY: (random) =>
    call('PackedColorArray', [`[${list(random, (r) => call('Color', components(r, 4))).join(', ')}]`]),
  PACKED_VECTOR4_ARRAY: (random) => call('PackedVector4Array', [`[${list(random, vector4).join(', ')}]`]),
};

export const VALUE_TYPES = Object.keys(BUILDERS);

/** A text that builds a value of `type`, a Variant::Type name such as `VECTOR2`. */
export function valueText(type, random) {
  const build = BUILDERS[type];
  if (!build) throw new Error(`expected a Variant type name, got ${type}`);
  return build(random);
}

const FORMATS = [
  '"%s"',
  '"%s|%s"',
  '"%d"',
  '"%5.2f"',
  '"%x"',
  '"%v"',
  '"%c"',
  '"%-4s|"',
  '"%+d"',
  '"%*d"',
  '"%%"',
  '"%o"',
  '"%X"',
  '"%05.1f"',
  '"%e"',
];

/** A format string for the `%` operator, of `type` STRING or STRING_NAME: `format`, else a random one. */
export function formatText(type, random, format = random.pick(FORMATS)) {
  return type === 'STRING_NAME' ? call('StringName', [format]) : format;
}

/** An Array or Dictionary text that holds `element` among others, so an `in` test can answer true. */
export function containerHolding(type, element, random) {
  if (type === 'ARRAY') return `[${elementText(random)}, ${element}]`;
  if (type === 'DICTIONARY') return `{${element}: ${elementText(random)}}`;
  return valueText(type, random);
}
