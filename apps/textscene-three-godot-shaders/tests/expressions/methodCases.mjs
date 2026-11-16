import { BUILTIN_TYPES } from '../../../../packages/textscene-core/src/godot/variant/call/builtinTypes.generated.ts';

/** The types whose methods the port runs: each later part of the slice adds its types here. */
export const PORTED_METHOD_TYPES = [
  'Vector2',
  'Vector2i',
  'Vector3',
  'Vector3i',
  'Vector4',
  'Vector4i',
  'Rect2',
  'Rect2i',
  'Color',
  'Plane',
  'AABB',
  'Quaternion',
  'Basis',
  'Transform2D',
  'Transform3D',
  'Projection',
  'String',
  'StringName',
  'NodePath',
];

/** A typical value of each type, then its edges: zero, negative zero, the float limits, NaN and infinity. */
export const EDGE_VALUES = {
  float: ['0.3', ['0', '-0.0', '-2.5', '1e30', '1e-30', 'NAN', 'INF']],
  int: ['3', ['0', '-1', '-7', '2147483647', '-2147483648', '4294967297']],
  bool: ['true', ['false']],
  String: [
    '"#ff8000"',
    [
      '""',
      '"#F80"',
      '"ff800080"',
      '"#ff80zz"',
      '"red"',
      '"#1234567"',
      '"a"',
      '"İ"',
      '"😀"',
      '"/"',
      '"."',
      '"_"',
    ],
  ],
  PackedStringArray: [
    'PackedStringArray(["a", "b"])',
    ['PackedStringArray()', 'PackedStringArray([""])', 'PackedStringArray(["x", "", "😀"])'],
  ],
  Variant: ['["x", 2]', ['{"a": 1, "b": 2.5}', '[["k", "v"], ["n", 3]]', '[["bad"]]', '7', 'null']],
  Vector2: [
    'Vector2(0.6, -0.8)',
    [
      'Vector2(0, 0)',
      'Vector2(-0.0, 0)',
      'Vector2(3, -4)',
      'Vector2(1e30, -1e30)',
      'Vector2(1e-30, 3e-30)',
      'Vector2(NAN, 1)',
      'Vector2(INF, -INF)',
    ],
  ],
  Vector2i: [
    'Vector2i(3, -4)',
    ['Vector2i(0, 0)', 'Vector2i(-7, 2)', 'Vector2i(2147483647, -2147483648)', 'Vector2i(-1, -1)'],
  ],
  Vector3: [
    'Vector3(0.6, 0, -0.8)',
    [
      'Vector3(0, 0, 0)',
      'Vector3(-0.0, 0, -0.0)',
      'Vector3(1, 2, 3)',
      'Vector3(1e30, -1e30, 1e30)',
      'Vector3(1e-30, 3e-30, -2e-30)',
      'Vector3(NAN, 1, 2)',
      'Vector3(INF, -INF, 0)',
    ],
  ],
  Vector3i: [
    'Vector3i(3, -4, 5)',
    [
      'Vector3i(0, 0, 0)',
      'Vector3i(-7, 2, 2)',
      'Vector3i(2147483647, -2147483648, 0)',
      'Vector3i(-1, -1, -1)',
    ],
  ],
  Vector4: [
    'Vector4(0.5, -0.5, 0.5, -0.5)',
    [
      'Vector4(0, 0, 0, 0)',
      'Vector4(-0.0, 0, -0.0, 0)',
      'Vector4(1, 2, 3, 4)',
      'Vector4(1e30, -1e30, 1e30, -1e30)',
      'Vector4(1e-30, 3e-30, -2e-30, 1e-30)',
      'Vector4(NAN, 1, 2, 3)',
      'Vector4(INF, -INF, 0, 1)',
    ],
  ],
  Vector4i: [
    'Vector4i(3, -4, 5, -6)',
    [
      'Vector4i(0, 0, 0, 0)',
      'Vector4i(-7, 2, 2, -7)',
      'Vector4i(2147483647, -2147483648, 0, 1)',
      'Vector4i(-1, -1, -1, -1)',
    ],
  ],
  Rect2: [
    'Rect2(1, 2, 3, 4)',
    [
      'Rect2(0, 0, 0, 0)',
      'Rect2(-0.0, 0, -0.0, 0)',
      'Rect2(1, 2, -3, -4)',
      'Rect2(1e30, -1e30, 1e30, 1e30)',
      'Rect2(1e-30, 3e-30, 2e-30, 1e-30)',
      'Rect2(NAN, 1, 2, 3)',
      'Rect2(INF, -INF, 0, 1)',
    ],
  ],
  Rect2i: [
    'Rect2i(1, 2, 3, 4)',
    [
      'Rect2i(0, 0, 0, 0)',
      'Rect2i(1, 2, -3, -4)',
      'Rect2i(2147483647, -2147483648, 1, 1)',
      'Rect2i(-1, -1, 2147483647, 2147483647)',
    ],
  ],
  Plane: [
    'Plane(0.6, 0, -0.8, 0.5)',
    [
      'Plane(0, 0, 0, 0)',
      'Plane(-0.0, 1, 0, -0.0)',
      'Plane(3, 4, 0, 5)',
      'Plane(1e30, -1e30, 1e30, 1e30)',
      'Plane(1e-30, 3e-30, -2e-30, 1e-30)',
      'Plane(NAN, 1, 0, 2)',
      'Plane(INF, -INF, 0, 1)',
    ],
  ],
  AABB: [
    'AABB(Vector3(-1, -2, -3), Vector3(2, 4, 6))',
    [
      'AABB(Vector3(0, 0, 0), Vector3(0, 0, 0))',
      'AABB(Vector3(-0.0, 0, -0.0), Vector3(-0.0, 1, 0))',
      'AABB(Vector3(1, 2, 3), Vector3(-1, -2, -3))',
      'AABB(Vector3(1e30, -1e30, 0), Vector3(1e30, 1e30, 1e30))',
      'AABB(Vector3(1e-30, 3e-30, 0), Vector3(2e-30, 1e-30, 1e-30))',
      'AABB(Vector3(NAN, 0, 0), Vector3(1, NAN, 1))',
      'AABB(Vector3(INF, -INF, 0), Vector3(1, INF, 1))',
    ],
  ],
  Quaternion: [
    'Quaternion(0.5, -0.5, 0.5, 0.5)',
    [
      'Quaternion(0, 0, 0, 1)',
      'Quaternion(0, 0, 0, 0)',
      'Quaternion(-0.0, 0, -0.0, -1)',
      'Quaternion(1, 2, 3, 4)',
      'Quaternion(0.1, 0.2, 0.3, 0.927362)',
      'Quaternion(1e30, -1e30, 1e30, 1e30)',
      'Quaternion(NAN, 0, 0, 1)',
      'Quaternion(INF, -INF, 0, 1)',
    ],
  ],
  Basis: [
    'Basis(Vector3(0, 0.6, -0.8), Vector3(1, 0, 0), Vector3(0, -0.8, -0.6))',
    [
      'Basis()',
      'Basis(Vector3(0, 0, 0), Vector3(0, 0, 0), Vector3(0, 0, 0))',
      'Basis(Vector3(-0.0, 1, 0), Vector3(-1, -0.0, 0), Vector3(0, 0, 1))',
      'Basis(Vector3(2, 0, 0), Vector3(0.5, 3, 0), Vector3(0, 0, -4))',
      'Basis(Vector3(1, 2, 3), Vector3(2, 4, 6), Vector3(0, 0, 1))',
      'Basis(Vector3(1e30, 0, 0), Vector3(0, -1e30, 0), Vector3(0, 0, 1e-30))',
      'Basis(Vector3(NAN, 0, 0), Vector3(0, 1, 0), Vector3(0, 0, 1))',
      'Basis(Vector3(INF, 0, 0), Vector3(0, -INF, 0), Vector3(0, 0, 1))',
    ],
  ],
  Transform2D: [
    'Transform2D(Vector2(1.2, 0.5), Vector2(-0.4, 2), Vector2(3, -4))',
    [
      'Transform2D()',
      'Transform2D(Vector2(0, 0), Vector2(0, 0), Vector2(0, 0))',
      'Transform2D(Vector2(-0.0, 1), Vector2(-1, -0.0), Vector2(-0.0, 0))',
      'Transform2D(Vector2(2, 0), Vector2(0, -2), Vector2(1, 1))',
      'Transform2D(Vector2(1, 2), Vector2(2, 4), Vector2(5, 6))',
      'Transform2D(Vector2(1e30, 0), Vector2(0, 1e-30), Vector2(1e30, -1e30))',
      'Transform2D(Vector2(NAN, 0), Vector2(0, 1), Vector2(0, 0))',
      'Transform2D(Vector2(INF, 0), Vector2(0, -INF), Vector2(0, 0))',
    ],
  ],
  Transform3D: [
    'Transform3D(Vector3(0, 1.2, -1.6), Vector3(1, 0, 0), Vector3(0, -0.8, -0.6), Vector3(3, -4, 5))',
    [
      'Transform3D()',
      'Transform3D(Vector3(0, 0, 0), Vector3(0, 0, 0), Vector3(0, 0, 0), Vector3(0, 0, 0))',
      'Transform3D(Vector3(-0.0, 1, 0), Vector3(-1, -0.0, 0), Vector3(0, 0, 1), Vector3(-0.0, 0, -0.0))',
      'Transform3D(Vector3(2, 0, 0), Vector3(0.5, 3, 0), Vector3(0, 0, -4), Vector3(1, 2, 3))',
      'Transform3D(Vector3(1, 2, 3), Vector3(2, 4, 6), Vector3(0, 0, 1), Vector3(1, 1, 1))',
      'Transform3D(Vector3(1e30, 0, 0), Vector3(0, -1e30, 0), Vector3(0, 0, 1e-30), Vector3(1e30, 0, -1e30))',
      'Transform3D(Vector3(NAN, 0, 0), Vector3(0, 1, 0), Vector3(0, 0, 1), Vector3(0, 0, 0))',
      'Transform3D(Vector3(INF, 0, 0), Vector3(0, -INF, 0), Vector3(0, 0, 1), Vector3(0, INF, 0))',
    ],
  ],
  Projection: [
    'Projection(Vector4(1.5, 0, 0, 0), Vector4(0, 2, 0, 0), Vector4(0.1, -0.2, -1.2, -1), Vector4(0.3, 0, -2.2, 0))',
    [
      'Projection()',
      'Projection(Vector4(0, 0, 0, 0), Vector4(0, 0, 0, 0), Vector4(0, 0, 0, 0), Vector4(0, 0, 0, 0))',
      'Projection(Vector4(-0.0, 1, 0, 0), Vector4(-1, -0.0, 0, 0), Vector4(0, 0, 1, -0.0), Vector4(-0.0, 0, 0, 1))',
      'Projection(Vector4(0.5, 0, 0, 0), Vector4(0, 0.25, 0, 0), Vector4(0, 0, -0.02, 0), Vector4(-0.1, 0.2, -1.01, 1))',
      'Projection(Vector4(1, 2, 3, 4), Vector4(2, 4, 6, 8), Vector4(0, 1, 0, 1), Vector4(1, 0, 1, 0))',
      'Projection(Vector4(0, 1, 0, 0), Vector4(1, 0, 0, 0), Vector4(0, 0, 0, 1), Vector4(0, 0, 1, 0))',
      'Projection(Vector4(1e30, 0, 0, 0), Vector4(0, 1e-30, 0, 0), Vector4(0, 0, -1e30, -1), Vector4(0, 0, 1e30, 0))',
      'Projection(Vector4(NAN, 0, 0, 0), Vector4(0, 1, 0, 0), Vector4(0, 0, 1, 0), Vector4(0, 0, 0, 1))',
      'Projection(Vector4(INF, 0, 0, 0), Vector4(0, -INF, 0, 0), Vector4(0, 0, 1, -1), Vector4(0, 0, INF, 0))',
    ],
  ],
  Color: [
    'Color(0.2, 0.4, 0.6, 0.8)',
    [
      'Color(0, 0, 0, 0)',
      'Color(-0.0, 0, -0.0, 1)',
      'Color(2, -1, 0.5, 1)',
      'Color(1e30, -1e30, 1e30, 1)',
      'Color(1e-30, 3e-30, 2e-30, 1)',
      'Color(NAN, 0.5, 0.5, 1)',
      'Color(INF, -INF, 0, 1)',
    ],
  ],
};

/** Words, case runs, paths, numbers, escapes, addresses and codes past the Basic Multilingual Plane. */
const TEXT_BASES = [
  '""',
  '"  padded\\t "',
  '"Godot Engine_4.6"',
  '"camelCaseHTTPServer2D"',
  '"ÄÖ straße İ ǅ"',
  '"😀 smile 😀"',
  '"-12.50e3"',
  '"0x1F"',
  '"C:\\\\dir/sub/file.tar.gz"',
  '"res://a/../b/./c.tscn"',
  '"192.168.0.1"',
  '"::ffff:10.0.0.1"',
  '"%41%e9+b%2"',
  '"line1\\nline2\\tq\\"x"',
  '"a,b,,c"',
  '"<a href=\'x\'>&amp;</a>"',
];

/** The typical base holds each String argument edge, and a StringName holds the same texts. */
const BASE_VALUES = {
  String: ['"a_red.b/#F80 a 😀İ"', TEXT_BASES],
  StringName: ['StringName("a_red.b/#F80 a 😀İ")', TEXT_BASES.map((text) => `StringName(${text})`)],
  NodePath: [
    'NodePath("Root/Child:position:x")',
    ['""', '"/"', '"/root/a/b"', '"a/b/c"', '":x:y"', '"."', '"../x:y"', '"a//b/"', '":"'].map(
      (text) => `NodePath(${text})`
    ),
  ],
};

/** A value the parameter does not take, so the binder's check fails and the method runs on the cast value. */
const wrongType = (argumentType) => (argumentType === 'String' ? 'Vector2(1, 2)' : '"x"');

const typical = (type) => EDGE_VALUES[type][0];
const edges = (type) => EDGE_VALUES[type][1];
const bases = (type) => {
  const [typicalBase, edgeBases] = BASE_VALUES[type] ?? EDGE_VALUES[type];
  return [typicalBase, ...edgeBases];
};

// Edges that build a String of two billion characters: Godot fills gigabytes and V8 holds no such string.
const GIANT_TEXT_EDGES = {
  repeat: ['2147483647'],
  lpad: ['2147483647', '-2147483648'],
  rpad: ['2147483647', '-2147483648'],
  pad_decimals: ['2147483647'],
  pad_zeros: ['2147483647'],
};
const isGiantText = (name, value) => GIANT_TEXT_EDGES[name]?.includes(value) ?? false;

/** The calls of one method: each base edge with typical arguments, then each argument through its edges. */
function callTexts(type, [name, , , , parameters]) {
  const argumentTypes = parameters.map(([argumentType]) => argumentType);
  const typicalArguments = argumentTypes.map(typical);
  const call = (base, args) => `${base}.${name}(${args.join(', ')})`;
  const baseCalls = bases(type).map((base) => call(base, typicalArguments));
  const argumentCalls = argumentTypes.flatMap((argumentType, index) =>
    [...edges(argumentType), wrongType(argumentType)]
      .filter((value) => !isGiantText(name, value))
      .map((value) => call(bases(type)[0], typicalArguments.with(index, value)))
  );
  return [...baseCalls, ...argumentCalls];
}

/** Every generated method call of the ported types, in a fixed order. */
export function methodCases() {
  return PORTED_METHOD_TYPES.flatMap((type) =>
    BUILTIN_TYPES[type].methods.flatMap((row) =>
      callTexts(type, row).map((text, index) => ({
        id: `method ${type}.${row[0]} ${index} ${JSON.stringify(text)}`,
        text,
        method: row[0],
      }))
    )
  );
}
