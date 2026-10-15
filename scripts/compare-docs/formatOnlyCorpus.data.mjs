/**
 * Literals Godot 4.6.3 reads from a `.tscn` and stores in a property slot,
 * keyed by the slot's Variant type as `node-properties.json` records it. Each
 * entry cites the tokenizer branch that reads it and, for a converted literal,
 * the `can_convert_strict` row that lets the setter take it. Written by hand
 * from the engine source, since no test may read the checkout.
 *
 * `stores: 'as-written'` holds the literal unchanged, so a validator that cites
 * no grounding reports nothing for it. `stores: 'converted'` holds another
 * form, so the `convertedSpelling` warning may fire, and an error may not.
 * `slot` narrows an entry: `'untyped'` for a container with no element hint,
 * or the `{ hint, hint_string }` the capture records.
 */

/** `Variant::Type` (`variant.h:96-145`), numbered as the capture stores it. */
const BOOL = 1;
const INT = 2;
const FLOAT = 3;
const STRING = 4;
const VECTOR2 = 5;
const VECTOR2I = 6;
const RECT2 = 7;
const RECT2I = 8;
const VECTOR3 = 9;
const VECTOR3I = 10;
const TRANSFORM2D = 11;
const QUATERNION = 15;
const AABB = 16;
const TRANSFORM3D = 18;
const COLOR = 20;
const STRING_NAME = 21;
const NODE_PATH = 22;
const OBJECT = 24;
const DICTIONARY = 27;
const ARRAY = 28;
const PACKED_BYTE_ARRAY = 29;
const PACKED_INT32_ARRAY = 30;
const PACKED_INT64_ARRAY = 31;
const PACKED_FLOAT32_ARRAY = 32;
const PACKED_FLOAT64_ARRAY = 33;
const PACKED_STRING_ARRAY = 34;
const PACKED_VECTOR2_ARRAY = 35;
const PACKED_VECTOR3_ARRAY = 36;
const PACKED_COLOR_ARRAY = 37;

/** `PropertyHint` (`object.h:50-96`), numbered as the capture stores it. */
const HINT_RESOURCE_TYPE = 17;
const HINT_TYPE_STRING = 23;
const HINT_ARRAY_TYPE = 31;

const asWritten = (type, literal, cite, slot) => ({ type, literal, cite, stores: 'as-written', slot });
const converted = (type, literal, cite, slot) => ({ type, literal, cite, stores: 'converted', slot });

/** The numeric token (`get_token`, `variant_parser.cpp:420-485`). */
const NUMBER = 'variant_parser.cpp:420-485';
/** The `inf`, `inf_neg` and `nan` identifiers (`variant_parser.cpp:701-707`). */
const NON_FINITE = 'variant_parser.cpp:701-707';
/** The string token, escapes included (`variant_parser.cpp:276-410`). */
const STRING_TOKEN = 'variant_parser.cpp:276-410';
/** The `&` StringName jacket and its 3.x `@` spelling (`variant_parser.cpp:263-265`). */
const STRING_NAME_TOKEN = 'variant_parser.cpp:263-265';
/** `_parse_array`, trailing comma included (`variant_parser.cpp:1643-1681`). */
const ARRAY_TOKEN = 'variant_parser.cpp:1643-1681';
/** `_parse_dictionary` (`variant_parser.cpp:1683-1747`). */
const DICTIONARY_TOKEN = 'variant_parser.cpp:1683-1747';
/** The `Array[T]([…])` wrapper (`variant_parser.cpp:1327-1409`). */
const TYPED_ARRAY_TOKEN = 'variant_parser.cpp:1327-1409';
/** An untyped setter keeps whatever `_parse_array` built (`array.cpp:217-227`). */
const UNTYPED_ASSIGN = 'array.cpp:217-227';
/** `TypedArray(const Array&)` converts each element (`typed_array.h:43-49`, `array.cpp:252-266`). */
const TYPED_ASSIGN = 'array.cpp:252-266';
/** A packed slot converts an Array (`variant.cpp:772-850`). */
const PACKED_FROM_ARRAY = 'variant.cpp:772-850';

const PACKED_TYPES = [
  [PACKED_BYTE_ARRAY, 'PackedByteArray(0, 255)', 'variant_parser.cpp:1410'],
  [PACKED_INT32_ARRAY, 'PackedInt32Array(1, -2)', 'variant_parser.cpp:1428'],
  [PACKED_INT64_ARRAY, 'PackedInt64Array(1, -2)', 'variant_parser.cpp:1446'],
  [PACKED_FLOAT32_ARRAY, 'PackedFloat32Array(1, 2.5)', 'variant_parser.cpp:1464'],
  [PACKED_FLOAT64_ARRAY, 'PackedFloat64Array(1, 2.5)', 'variant_parser.cpp:1482'],
  [PACKED_STRING_ARRAY, 'PackedStringArray("a", "b")', 'variant_parser.cpp:1500'],
  [PACKED_VECTOR2_ARRAY, 'PackedVector2Array(1, 2, 3, 4)', 'variant_parser.cpp:1546'],
  [PACKED_VECTOR3_ARRAY, 'PackedVector3Array(1, 2, 3)', 'variant_parser.cpp:1564'],
  [PACKED_COLOR_ARRAY, 'PackedColorArray(1, 0, 0, 1)', 'variant_parser.cpp:1600'],
];

const NODE_PATH_ELEMENTS = { hint: HINT_ARRAY_TYPE, hint_string: 'NodePath' };
const INDEX_LISTS = { hint: HINT_TYPE_STRING, hint_string: 'PackedInt32Array' };
const RESOURCES = { hint: HINT_RESOURCE_TYPE };

/**
 * Properties whose setter takes another Variant type than `ADD_PROPERTY` declares.
 * `VariantCasterAndValidate` checks the argument against the setter's own type
 * (`binder_common.h:175`), so that type's corpus applies. Keyed by
 * `Class.property`, each citing the setter's signature.
 */
export const SETTER_TYPES = new Map([
  ['Control.theme_type_variation', { type: STRING_NAME, cite: 'control.cpp:3017' }],
  ['Window.theme_type_variation', { type: STRING_NAME, cite: 'window.cpp:2490' }],
  ['XRNode3D.tracker', { type: STRING_NAME, cite: 'xr_nodes.cpp:291' }],
  ['XRNode3D.pose', { type: STRING_NAME, cite: 'xr_nodes.cpp:315' }],
  ['XRBodyModifier3D.body_tracker', { type: STRING_NAME, cite: 'xr_body_modifier_3d.cpp:59' }],
  ['XRFaceModifier3D.face_tracker', { type: STRING_NAME, cite: 'xr_face_modifier_3d.cpp:505' }],
  ['XRHandModifier3D.hand_tracker', { type: STRING_NAME, cite: 'xr_hand_modifier_3d.cpp:51' }],
]);

export const FORMAT_ONLY_CORPUS = [
  asWritten(BOOL, 'true', 'variant_parser.cpp:695-696'),
  asWritten(BOOL, 'false', 'variant_parser.cpp:697-698'),
  converted(BOOL, '1', 'variant.cpp:550-557'),

  asWritten(INT, '0', NUMBER),
  asWritten(INT, '-1', NUMBER),
  converted(INT, 'true', 'variant.cpp:560-568'),

  asWritten(FLOAT, '1.5', NUMBER),
  asWritten(FLOAT, '-0.0', NUMBER),
  asWritten(FLOAT, '1e-3', NUMBER),
  asWritten(FLOAT, 'inf', NON_FINITE),
  asWritten(FLOAT, 'inf_neg', NON_FINITE),
  asWritten(FLOAT, 'nan', NON_FINITE),
  converted(FLOAT, '1', 'variant.cpp:571-580'),

  asWritten(STRING, '""', STRING_TOKEN),
  asWritten(STRING, String.raw`"a\"b"`, STRING_TOKEN),
  converted(STRING, '&"x"', 'variant.cpp:582-589'),
  converted(STRING, '@"x"', STRING_NAME_TOKEN),
  converted(STRING, 'NodePath("x")', 'variant.cpp:582-589'),

  asWritten(STRING_NAME, '&"x"', STRING_NAME_TOKEN),
  asWritten(STRING_NAME, '@"x"', STRING_NAME_TOKEN),
  converted(STRING_NAME, '"x"', 'variant.cpp:738-744'),

  asWritten(NODE_PATH, 'NodePath("a/b")', 'variant_parser.cpp:920-939'),
  asWritten(NODE_PATH, 'NodePath("")', 'variant_parser.cpp:920-939'),
  converted(NODE_PATH, '"a/b"', 'variant.cpp:746-752'),

  asWritten(VECTOR2, 'Vector2(1, 2)', 'variant_parser.cpp:708'),
  asWritten(VECTOR2, 'Vector2(inf, nan)', 'variant_parser.cpp:150-155'),
  converted(VECTOR2, 'Vector2i(1, 2)', 'variant.cpp:591-598'),
  asWritten(VECTOR2I, 'Vector2i(1, 2)', 'variant_parser.cpp:721'),
  converted(VECTOR2I, 'Vector2(1, 2)', 'variant.cpp:600-607'),
  asWritten(RECT2, 'Rect2(0, 0, 1, 1)', 'variant_parser.cpp:734'),
  converted(RECT2, 'Rect2i(0, 0, 1, 1)', 'variant.cpp:609-616'),
  asWritten(RECT2I, 'Rect2i(0, 0, 1, 1)', 'variant_parser.cpp:747'),
  converted(RECT2I, 'Rect2(0, 0, 1, 1)', 'variant.cpp:618-625'),
  asWritten(VECTOR3, 'Vector3(1, 2, 3)', 'variant_parser.cpp:760'),
  converted(VECTOR3, 'Vector3i(1, 2, 3)', 'variant.cpp:635-642'),
  asWritten(VECTOR3I, 'Vector3i(1, 2, 3)', 'variant_parser.cpp:773'),
  converted(VECTOR3I, 'Vector3(1, 2, 3)', 'variant.cpp:644-651'),
  asWritten(TRANSFORM2D, 'Transform2D(1, 0, 0, 1, 0, 0)', 'variant_parser.cpp:812'),
  asWritten(QUATERNION, 'Quaternion(0, 0, 0, 1)', 'variant_parser.cpp:842'),
  asWritten(AABB, 'AABB(0, 0, 0, 1, 1, 1)', 'variant_parser.cpp:855'),
  asWritten(TRANSFORM3D, 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)', 'variant_parser.cpp:881'),

  asWritten(COLOR, 'Color(1, 0, 0, 1)', 'variant_parser.cpp:907-919'),
  // `Variant::operator Color` reads a STRING as HTML or a name and an INT as
  // RGBA hex (`variant.cpp:1986-1996`).
  converted(COLOR, '"ff0000"', 'variant.cpp:712-719'),
  converted(COLOR, '"red"', 'variant.cpp:712-719'),
  converted(COLOR, '4294967295', 'variant.cpp:712-719'),

  asWritten(OBJECT, 'null', 'variant_parser.cpp:699-700'),
  asWritten(OBJECT, 'SubResource("a")', 'variant_parser.cpp:1115-1121', RESOURCES),
  asWritten(OBJECT, 'ExtResource("1")', 'variant_parser.cpp:1103-1114', RESOURCES),
  // The text loader sets no `rp.func`, so `Resource(…)` loads by path.
  asWritten(OBJECT, 'Resource("res://a.tres")', 'variant_parser.cpp:1123-1185', RESOURCES),

  asWritten(DICTIONARY, '{}', DICTIONARY_TOKEN),
  asWritten(DICTIONARY, '{"a": 1}', DICTIONARY_TOKEN, 'untyped'),
  asWritten(DICTIONARY, '{1: null}', DICTIONARY_TOKEN, 'untyped'),
  asWritten(DICTIONARY, 'Dictionary[String, int]({"a": 1})', 'variant_parser.cpp:1187', 'untyped'),

  asWritten(ARRAY, '[]', ARRAY_TOKEN),
  asWritten(ARRAY, '[null]', UNTYPED_ASSIGN, 'untyped'),
  asWritten(ARRAY, '[1, "a"]', UNTYPED_ASSIGN, 'untyped'),
  asWritten(ARRAY, '[1,]', ARRAY_TOKEN, 'untyped'),
  asWritten(ARRAY, 'Array[int]([1])', TYPED_ARRAY_TOKEN, 'untyped'),
  asWritten(ARRAY, 'Array[String]([])', TYPED_ARRAY_TOKEN, 'untyped'),
  asWritten(ARRAY, '[NodePath("a")]', TYPED_ASSIGN, NODE_PATH_ELEMENTS),
  asWritten(ARRAY, 'Array[NodePath]([NodePath("a")])', TYPED_ARRAY_TOKEN, NODE_PATH_ELEMENTS),
  converted(ARRAY, '["a"]', TYPED_ASSIGN, NODE_PATH_ELEMENTS),
  converted(ARRAY, 'Array[String](["a"])', 'array.cpp:267-274', NODE_PATH_ELEMENTS),
  asWritten(ARRAY, '[PackedInt32Array(0, 1, 2)]', 'polygon_2d.cpp:435-437', INDEX_LISTS),
  asWritten(ARRAY, '[null]', 'polygon_2d.cpp:435-437', INDEX_LISTS),

  ...PACKED_TYPES.flatMap(([type, literal, cite]) => [
    asWritten(type, `${literal.slice(0, literal.indexOf('('))}()`, cite),
    asWritten(type, literal, cite),
    converted(type, '[]', PACKED_FROM_ARRAY),
  ]),
];
