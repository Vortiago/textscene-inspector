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
  'Array',
  'Dictionary',
  'PackedByteArray',
  'PackedInt32Array',
  'PackedInt64Array',
  'PackedFloat32Array',
  'PackedFloat64Array',
  'PackedStringArray',
  'PackedVector2Array',
  'PackedVector3Array',
  'PackedColorArray',
  'PackedVector4Array',
  'Callable',
  'Signal',
  'RID',
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
  PackedByteArray: ['PackedByteArray([1, 2])', ['PackedByteArray()', 'PackedByteArray([255, 0, 128])']],
  PackedInt32Array: [
    'PackedInt32Array([3, 4])',
    ['PackedInt32Array()', 'PackedInt32Array([-1, 2147483647])'],
  ],
  PackedInt64Array: [
    'PackedInt64Array([3, 4])',
    ['PackedInt64Array()', 'PackedInt64Array([-1, 9223372036854775807])'],
  ],
  PackedFloat32Array: [
    'PackedFloat32Array([0.3, 2])',
    ['PackedFloat32Array()', 'PackedFloat32Array([NAN, -0.0])'],
  ],
  PackedFloat64Array: [
    'PackedFloat64Array([0.3, 2])',
    ['PackedFloat64Array()', 'PackedFloat64Array([NAN, -0.0])'],
  ],
  PackedVector2Array: [
    'PackedVector2Array([Vector2(1, 2)])',
    ['PackedVector2Array()', 'PackedVector2Array([Vector2(NAN, 0)])'],
  ],
  PackedVector3Array: ['PackedVector3Array([Vector3(1, 2, 3)])', ['PackedVector3Array()']],
  PackedColorArray: ['PackedColorArray([Color(1, 0, 0)])', ['PackedColorArray()']],
  PackedVector4Array: ['PackedVector4Array([Vector4(1, 2, 3, 4)])', ['PackedVector4Array()']],
  StringName: ['StringName("has")', ['StringName("")', 'StringName("size")', '"find"']],
  Variant: ['["x", 2]', ['{"a": 1, "b": 2.5}', '[["k", "v"], ["n", 3]]', '[["bad"]]', '7', 'null']],
  Array: [
    '[1, "x"]',
    ['[]', '[["x", 2], 7]', 'Array([1.5, 2], 3, "", null)', '[NAN, null]', '[[1, [2]], {"a": [3]}]'],
  ],
  Callable: [
    '[3, "x", 7].has',
    [
      'Callable()',
      '[1, 7].find',
      '"x".begins_with',
      'Vector2(1, 2).dot',
      '[].push_back',
      '[1, 2, 3, 4].pop_at',
      '[5, 6].insert',
      '[0].size',
      '{"x": 1, 7: 2}.erase',
      '{}.get_or_add',
    ],
  ],
  Dictionary: [
    '{"x": 9, "n": [1]}',
    [
      '{}',
      '{"x": 1, 7: 2.5, ["x", 2]: null}',
      'Dictionary({"x": 1}, 4, StringName(""), null, 2, StringName(""), null)',
      '{NAN: NAN, StringName("x"): "y"}',
    ],
  ],
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
  Array: [
    '[3, ["x", 2], "x", 2.5, 7, null, Vector2(1, 2), "x"]',
    [
      '[]',
      '[1]',
      '[3, 1, 2, 1]',
      '[NAN, 1, NAN]',
      '["b", StringName("a"), "a"]',
      '[[1, [2]], {"a": [3]}]',
      '[3, "a", null, 2]',
      'Array([1.5, 2], 3, "", null)',
      'Array([Vector2(1, 2)], 5, "", null)',
      '[9, 2, 7, 2.0, 5, 1, 8, 3, 6, 4, 0, 2, 7, 5, 1, 9, 3, 8]',
      '[4, "a", 2, null, 3, "b", 1, 5, [0], 7, 6, "c", 9, 8, 0, 2, 1, 3]',
    ],
  ],
  Dictionary: [
    '{"x": 1, 7: 2.5, ["x", 2]: null, StringName("k"): [1, {"a": 2}], null: 7, 2: "x"}',
    [
      '{}',
      '{"a": 1}',
      '{3: 1, 1: 2, 2: 3, "b": 4, "a": 5}',
      '{NAN: NAN, 1.0: 1}',
      '{StringName("x"): 1, "y": 2}',
      'Dictionary({"x": 1.5, "y": 2}, 4, StringName(""), null, 3, StringName(""), null)',
      'Dictionary({1: Vector2(1, 2)}, 2, "", null, 5, "", null)',
      '{[1]: {"a": [2]}, {"k": 1}: [[3]]}',
    ],
  ],
  PackedByteArray: [
    'PackedByteArray([3, 1, 2, 250, 0, 128, 255, 64, 60, 0, 0, 0, 255, 254, 65, 0, 3])',
    [
      'PackedByteArray()',
      'PackedByteArray([0])',
      'PackedByteArray([65, 66, 67])',
      'PackedByteArray([255, 254, 65, 0, 61, 216, 0, 222])',
      'PackedByteArray([254, 255, 0, 65, 0, 0, 0, 66])',
      'PackedByteArray([0, 0, 128, 127, 0, 0, 192, 127, 0, 0, 128, 255, 1, 0, 0, 0])',
      'PackedByteArray([0, 60, 0, 124, 1, 0, 255, 251, 0, 0, 0, 0, 0, 0, 240, 63])',
      'PackedByteArray([0, 216, 0, 220, 255, 255, 17, 0])',
      'PackedByteArray([3, 1, 2, 1, 3, 2])',
      'var_to_bytes([1, "x", Vector2(1, 2)])',
      'var_to_bytes(Color(0.2, 0.4, 0.6, 0.8))',
      '"aé😀".to_utf8_buffer()',
    ],
  ],
  PackedInt32Array: [
    'PackedInt32Array([5, 3, -1, 3, 2147483647, -2147483648, 0])',
    [
      'PackedInt32Array()',
      'PackedInt32Array([3])',
      'PackedInt32Array([1, 2, 3, 3, 4])',
      'PackedInt32Array([9, 2, 7, 2, 5, 1, 8, 3, 6, 4, 0, 2, 7, 5, 1, 9, 3, 8])',
    ],
  ],
  PackedInt64Array: [
    'PackedInt64Array([5, 3, -1, 3, 9223372036854775807, -9223372036854775808, 0])',
    [
      'PackedInt64Array()',
      'PackedInt64Array([3])',
      'PackedInt64Array([1, 2, 3, 3, 4])',
      'PackedInt64Array([9, 2, 7, 2, 5, 1, 8, 3, 6, 4, 0, 2, 7, 5, 1, 9, 3, 8])',
    ],
  ],
  PackedFloat32Array: [
    'PackedFloat32Array([0.5, 0.3, -0.0, 0.3, 1e30, NAN, INF, 0])',
    [
      'PackedFloat32Array()',
      'PackedFloat32Array([0.3])',
      'PackedFloat32Array([NAN, 1, NAN])',
      'PackedFloat32Array([1e-45, -1e-30, 3.4e38, 0.1, 0.2])',
      'PackedFloat32Array([9, 2, 7, 2, 5, 1, 8, 3, 6, 4, 0, 2, 7, 5, 1, 9, 3, 0.3])',
    ],
  ],
  PackedFloat64Array: [
    'PackedFloat64Array([0.5, 0.3, -0.0, 0.3, 1e300, NAN, INF, 0])',
    [
      'PackedFloat64Array()',
      'PackedFloat64Array([0.3])',
      'PackedFloat64Array([NAN, 1, NAN])',
      'PackedFloat64Array([5e-324, -1e-300, 1.7e308, 0.1, 0.2])',
      'PackedFloat64Array([9, 2, 7, 2, 5, 1, 8, 3, 6, 4, 0, 2, 7, 5, 1, 9, 3, 0.3])',
    ],
  ],
  PackedStringArray: [
    'PackedStringArray(["b", "#ff8000", "", "😀", "#ff8000", "B", "a"])',
    [
      'PackedStringArray()',
      'PackedStringArray(["#ff8000"])',
      'PackedStringArray(["é", "e", "z", "Z", "ä", "😀", "ｚ"])',
      'PackedStringArray(["9", "2", "7", "2", "5", "1", "8", "3", "6", "4", "0", "2", "7", "5", "1", "9", "3", "8"])',
    ],
  ],
  PackedVector2Array: [
    'PackedVector2Array([Vector2(1, 2), Vector2(0.6, -0.8), Vector2(1, -2), Vector2(NAN, 0), Vector2(0.6, -0.8), Vector2(-0.0, 0)])',
    [
      'PackedVector2Array()',
      'PackedVector2Array([Vector2(0.6, -0.8)])',
      'PackedVector2Array([Vector2(2, 1), Vector2(1, 2), Vector2(1, 1), Vector2(2, 0), Vector2(1e30, -INF)])',
    ],
  ],
  PackedVector3Array: [
    'PackedVector3Array([Vector3(1, 2, 3), Vector3(0.6, 0, -0.8), Vector3(1, 2, -3), Vector3(NAN, 0, 0), Vector3(0.6, 0, -0.8)])',
    [
      'PackedVector3Array()',
      'PackedVector3Array([Vector3(0.6, 0, -0.8)])',
      'PackedVector3Array([Vector3(2, 1, 0), Vector3(1, 2, 2), Vector3(1, 2, 1), Vector3(-0.0, 0, INF)])',
    ],
  ],
  PackedColorArray: [
    'PackedColorArray([Color(1, 0, 0), Color(0.2, 0.4, 0.6, 0.8), Color(1, 0, 0, 0.5), Color(NAN, 0, 0), Color(0.2, 0.4, 0.6, 0.8)])',
    [
      'PackedColorArray()',
      'PackedColorArray([Color(0.2, 0.4, 0.6, 0.8)])',
      'PackedColorArray([Color(0, 1, 0), Color(0, 0.5, 1), Color(0, 0.5, 0.5, 0), Color(2, -1, 0, 1)])',
    ],
  ],
  PackedVector4Array: [
    'PackedVector4Array([Vector4(1, 2, 3, 4), Vector4(0.5, -0.5, 0.5, -0.5), Vector4(1, 2, 3, -4), Vector4(0.5, -0.5, 0.5, -0.5)])',
    [
      'PackedVector4Array()',
      'PackedVector4Array([Vector4(0.5, -0.5, 0.5, -0.5)])',
      'PackedVector4Array([Vector4(2, 1, 0, 0), Vector4(1, 2, 2, 2), Vector4(1, 2, 2, 1), Vector4(NAN, 0, 0, 0)])',
    ],
  ],
  Callable: [
    '[3, "x", 7].has',
    [
      'Callable()',
      '[1, 7].find.bind(7)',
      '"x".begins_with.unbind(2)',
      '[3].has.bind(3).bind(4)',
      '[3].has.bindv([3])',
      '[3].has.unbind(1).bind(5, 6)',
      'Callable().bind(1)',
      'Vector2(1, 2).dot',
      '{"a": 1}.get',
    ],
  ],
  Signal: ['Signal()', ['Signal(null, "changed")']],
  RID: ['RID()', ['RID(RID())']],
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

// Edges that build a String or an array of two billion elements: Godot fills gigabytes, V8 holds none.
const GIANT_EDGES = {
  resize: ['2147483647'],
  repeat: ['2147483647'],
  lpad: ['2147483647', '-2147483648'],
  rpad: ['2147483647', '-2147483648'],
  pad_decimals: ['2147483647'],
  pad_zeros: ['2147483647'],
};
// A Packed*Array resizes to an int64 count, so 4294967297 does not wrap as an Array's int32 count does.
const PACKED_GIANT_EDGES = { resize: ['4294967297'] };
const giantEdges = (type, name) => [
  ...(GIANT_EDGES[name] ?? []),
  ...((type.startsWith('Packed') && PACKED_GIANT_EDGES[name]) || []),
];
const isGiant = (type, name, value) => giantEdges(type, name).includes(value);

/** The calls of one method: each base edge with typical arguments, then each argument through its edges. */
function callTexts(type, [name, , , , parameters]) {
  const argumentTypes = parameters.map(([argumentType]) => argumentType);
  const typicalArguments = argumentTypes.map(typical);
  const call = (base, args) => `${base}.${name}(${args.join(', ')})`;
  const baseCalls = bases(type).map((base) => call(base, typicalArguments));
  const argumentCalls = argumentTypes.flatMap((argumentType, index) =>
    [...edges(argumentType), wrongType(argumentType)]
      .filter((value) => !isGiant(type, name, value))
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
