import { probeOf } from './languageProbes.mjs';

/** A probe whose material sets `materialValues`, each a Variant's text, in an HDR 2D viewport or not. */
function uniformProbe(name, rows, source, { materialValues, hdr2d } = {}) {
  return {
    ...probeOf(`uniform-${name}`, rows, source),
    ...(materialValues === undefined ? {} : { materialValues }),
    ...(hdr2d ? { hdr2d: true } : {}),
  };
}

/** A default of each type, a constant Godot converts to the type, and the default of none. */
const DEFAULTS = [
  ['float', '-1.5'],
  ['int', '-7'],
  ['uint', '4000000000u'],
  ['bool', 'true'],
  ['vec2', 'vec2(0.25, -2.0)'],
  ['vec3', 'vec3(0.25, -2.0, 3.5)'],
  ['vec4', 'vec4(0.25, -2.0, 3.5, 1e-3)'],
  ['ivec2', 'ivec2(-3, 7)'],
  ['ivec3', 'ivec3(-3, 7, 2147483647)'],
  ['ivec4', 'ivec4(-3, 7, 0, -2147483648)'],
  ['uvec2', 'uvec2(1u, 4000000000u)'],
  ['uvec3', 'uvec3(1u, 2u, 3u)'],
  ['uvec4', 'uvec4(0u, 1u, 2u, 4294967295u)'],
  ['bvec2', 'bvec2(true, false)'],
  ['bvec3', 'bvec3(false, true, true)'],
  ['bvec4', 'bvec4(true, false, true, false)'],
  ['mat2', 'mat2(vec2(1.0, 2.0), vec2(-3.0, 4.5))'],
  ['mat3', 'mat3(vec3(1.0, 2.0, 3.0), vec3(4.0, 5.0, 6.0), vec3(7.0, 8.0, -9.0))'],
  ['mat4', 'mat4(2.0)'],
];

function defaultProbes() {
  return [
    ...DEFAULTS.map(([type, value]) =>
      uniformProbe(
        `default-${type}`,
        ['uniform'],
        `uniform ${type} u = ${value};\n${type} probe() { return u; }`
      )
    ),
    ...DEFAULTS.map(([type]) =>
      uniformProbe(`unset-${type}`, ['uniform'], `uniform ${type} u;\n${type} probe() { return u; }`)
    ),
    uniformProbe('default-int-to-float', ['uniform'], 'uniform float u = 3;\nfloat probe() { return u; }'),
    uniformProbe('default-int-to-uint', ['uniform'], 'uniform uint u = 5;\nuint probe() { return u; }'),
    uniformProbe('default-uint-to-int', ['uniform'], 'uniform int u = 5u;\nint probe() { return u; }'),
    uniformProbe(
      'precision',
      ['uniform'],
      'uniform highp vec2 u = vec2(1.0, 2.0);\nuniform lowp int i = 3;\nvec2 probe() { return u * float(i); }'
    ),
  ];
}

/** The material's value of each type, and the conversions `convert_to_vector` makes. */
const MATERIAL_VALUES = [
  ['float', 'float', '0.1'],
  ['float-of-int', 'float', '16777217'],
  ['float-of-string', 'float', '"2.5"'],
  ['int', 'int', '-7'],
  ['int-of-float', 'int', '-7.9'],
  ['uint', 'uint', '3000000000'],
  ['uint-of-negative', 'uint', '-1'],
  ['uint-of-large-float', 'uint', '3000000000.0'],
  ['bool', 'bool', 'true'],
  ['bool-of-int', 'bool', '2'],
  ['vec2', 'vec2', 'Vector2(1.5, -2)'],
  ['vec2-of-vector3', 'vec2', 'Vector3(1.5, -2, 3)'],
  ['vec2-of-array', 'vec2', '[1.5]'],
  ['vec3', 'vec3', 'Vector3(1.5, -2, 3)'],
  ['vec3-of-vector2i', 'vec3', 'Vector2i(4, -5)'],
  ['vec3-of-color', 'vec3', 'Color(2, 0.5, 0.01, 0.25)'],
  ['vec4', 'vec4', 'Vector4(1.5, -2, 3, 0.25)'],
  ['vec4-of-quaternion', 'vec4', 'Quaternion(1, 2, 3, 4)'],
  ['vec4-of-plane', 'vec4', 'Plane(1, 2, 3, 4)'],
  ['vec4-of-rect2', 'vec4', 'Rect2(1, 2, 3, 4)'],
  ['vec4-of-color', 'vec4', 'Color(2, 0.5, 0.01, 0.25)'],
  ['vec4-of-packed', 'vec4', 'PackedFloat32Array(1, 2, 3, 4, 5)'],
  ['ivec2', 'ivec2', 'Vector2i(-3, 7)'],
  ['ivec3-of-vector3', 'ivec3', 'Vector3(1.9, -1.9, 2.5)'],
  ['ivec4-of-rect2i', 'ivec4', 'Rect2i(1, -2, 3, 4)'],
  ['uvec2', 'uvec2', 'Vector2i(-1, 7)'],
  ['uvec3-of-array', 'uvec3', '[1, -2]'],
  ['bvec3-of-int', 'bvec3', '5'],
  ['bvec4-of-int', 'bvec4', '10'],
  ['mat2', 'mat2', 'Transform2D(1, 2, 3, 4, 5, 6)'],
  ['mat3', 'mat3', 'Basis(1, 2, 3, 4, 5, 6, 7, 8, 9)'],
  ['mat3-of-quaternion', 'mat3', 'Quaternion(0, 0.6, 0, 0.8)'],
  ['mat4', 'mat4', 'Projection(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16)'],
  ['mat4-of-transform3d', 'mat4', 'Transform3D(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)'],
  ['float-nan', 'float', 'nan'],
];

function materialValueProbes() {
  return MATERIAL_VALUES.map(([name, type, value]) =>
    uniformProbe(`material-${name}`, ['uniform'], `uniform ${type} u;\n${type} probe() { return u; }`, {
      materialValues: { u: value },
    })
  );
}

/** Arrays: no default, the material's packed arrays and Arrays, a missing element, and a NaN first. */
const ARRAYS = [
  ['float-unset', 'float u[4]', 'vec4(u[0], u[1], u[2], u[3])', 'vec4', undefined],
  [
    'float-nan-first',
    'float u[4]',
    'vec4(u[0], u[1], u[2], u[3])',
    'vec4',
    'PackedFloat32Array(nan, 1, -0.0, inf)',
  ],
  ['float-short', 'float u[4]', 'vec4(u[0], u[1], u[2], u[3])', 'vec4', 'PackedFloat32Array(1, 2)'],
  ['int', 'int u[3]', 'ivec3(u[0], u[1], u[2])', 'ivec3', 'PackedInt32Array(-1, 2, 2147483647)'],
  ['uint', 'uint u[2]', 'uvec2(u[0], u[1])', 'uvec2', 'PackedInt32Array(-1, 5)'],
  ['bool', 'bool u[3]', 'bvec3(u[0], u[1], u[2])', 'bvec3', '[true, 0, 2]'],
  ['vec2-of-array', 'vec2 u[3]', 'vec4(u[0], u[1].x, u[2].y)', 'vec4', '[Vector2(1, 2), 3, Vector2i(4, 5)]'],
  ['vec2-of-numbers', 'vec2 u[2]', 'vec4(u[0], u[1])', 'vec4', '[1, 2, 3.5, 4]'],
  [
    'vec3-of-colors',
    'vec3 u[2]',
    'mat2(u[0].xy, u[1].yz)',
    'mat2',
    'PackedColorArray(1, 0.5, 0, 1, 0, 2, 0.25, 0.5)',
  ],
  ['vec4-of-colors', 'vec4 u[1]', 'u[0]', 'vec4', 'PackedColorArray(1, 0.5, 0.01, 0.5)'],
  ['vec4-unset', 'vec4 u[2]', 'u[1]', 'vec4', undefined],
  ['ivec2', 'ivec2 u[2]', 'ivec4(u[0], u[1])', 'ivec4', 'PackedInt32Array(1, -2, 3, 4)'],
  ['bvec2', 'bvec2 u[2]', 'bvec4(u[0], u[1])', 'bvec4', '[Vector2i(1, 0), Vector2i(0, 7)]'],
  ['mat2-unset', 'mat2 u[2]', 'u[1]', 'mat2', undefined],
  ['mat2-short', 'mat2 u[2]', 'u[0] + u[1]', 'mat2', 'PackedFloat32Array(1, 2, 3, 4)'],
  ['mat3-of-bases', 'mat3 u[2]', 'u[0] + u[1]', 'mat3', '[Basis(1, 2, 3, 4, 5, 6, 7, 8, 9)]'],
  [
    'mat4-of-floats',
    'mat4 u[1]',
    'u[0]',
    'mat4',
    'PackedFloat32Array(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16)',
  ],
];

function arrayProbes() {
  return ARRAYS.map(([name, declaration, value, returns, materialValue]) =>
    uniformProbe(
      `array-${name}`,
      ['uniform', 'NODE_TYPE_ARRAY'],
      `uniform ${declaration};\n${returns} probe() { return ${value}; }`,
      materialValue === undefined ? {} : { materialValues: { u: materialValue } }
    )
  );
}

/** A uniform read in a function the probe calls, at a computed index, and passed as an argument. */
function readProbes() {
  return [
    uniformProbe(
      'computed-index',
      ['uniform', 'NODE_TYPE_ARRAY'],
      'uniform float u[4];\nfloat probe(int i) { return u[i & 3]; }',
      { materialValues: { u: 'PackedFloat32Array(1.5, -2.5, 3.5, nan)' } }
    ),
    uniformProbe(
      'in-called-function',
      ['uniform'],
      'uniform vec2 u = vec2(2.0, 3.0);\nvec2 scaled(vec2 a) { return a * u; }\nvec2 probe(vec2 a) { return scaled(a) + u; }'
    ),
    uniformProbe(
      'as-argument',
      ['uniform'],
      'uniform mat2 u = mat2(vec2(1.0, 2.0), vec2(3.0, 4.0));\nvec2 times(mat2 m, vec2 a) { return m * a; }\nvec2 probe(vec2 a) { return times(u, a); }'
    ),
  ];
}

/** `source_color` and `color_conversion_disabled`, which go to linear only in an HDR 2D viewport. */
function colorProbes() {
  const sourceColor = 'uniform vec4 u : source_color';
  const disabled = 'uniform vec4 u : source_color, color_conversion_disabled';
  const value = { materialValues: { u: 'Color(2, 0.5, 0.01, 0.25)' } };
  const cases = [
    ['default', ['source_color'], `${sourceColor} = vec4(2.0, 0.5, 0.01, 0.25);`, {}],
    ['unset', ['source_color'], `${sourceColor};`, {}],
    ['value', ['source_color'], `${sourceColor};`, value],
    [
      'disabled-default',
      ['source_color', 'color_conversion_disabled'],
      `${disabled} = vec4(2.0, 0.5, 0.01, 0.25);`,
      {},
    ],
    ['disabled-unset', ['source_color', 'color_conversion_disabled'], `${disabled};`, {}],
    ['disabled-value', ['source_color', 'color_conversion_disabled'], `${disabled};`, value],
    ['plain-value', [], 'uniform vec4 u;', value],
  ];
  const vec3Cases = [
    ['vec3-default', ['source_color'], 'uniform vec3 v : source_color = vec3(0.5, 2.0, 0.02);', {}],
    ['vec3-unset', ['source_color'], 'uniform vec3 v : source_color;', {}],
  ];
  return [false, true].flatMap((hdr2d) => {
    const viewport = hdr2d ? 'hdr' : 'ldr';
    return [
      ...cases.map(([name, rows, declaration, extra]) =>
        uniformProbe(
          `color-${name}-${viewport}`,
          ['uniform', ...rows],
          `${declaration}\nvec4 probe() { return u; }`,
          {
            ...extra,
            hdr2d,
          }
        )
      ),
      ...vec3Cases.map(([name, rows, declaration]) =>
        uniformProbe(
          `color-${name}-${viewport}`,
          ['uniform', ...rows],
          `${declaration}\nvec3 probe() { return v; }`,
          {
            hdr2d,
          }
        )
      ),
      uniformProbe(
        `color-array-${viewport}`,
        ['uniform', 'source_color', 'NODE_TYPE_ARRAY'],
        'uniform vec4 u[2] : source_color;\nvec4 probe() { return u[0] + u[1] * 4.0; }',
        { materialValues: { u: 'PackedColorArray(2, 0.5, 0.01, 0.25)' }, hdr2d }
      ),
    ];
  });
}

/** `hint_range`, `hint_enum` and `group_uniforms` change no value the shader reads. */
function hintProbes() {
  return [
    uniformProbe(
      'hint-range-float',
      ['uniform', 'hint_range'],
      'uniform float u : hint_range(0, 10, 0.5) = 20.0;\nuniform float w : hint_range(-1.0, 1.0);\nvec2 probe() { return vec2(u, w); }'
    ),
    uniformProbe(
      'hint-range-int',
      ['uniform', 'hint_range'],
      'uniform int u : hint_range(0, 4) = -3;\nint probe() { return u; }',
      { materialValues: { u: '9' } }
    ),
    uniformProbe(
      'hint-enum',
      ['uniform', 'hint_enum'],
      'uniform int u : hint_enum("Low", "High") = 1;\nint probe() { return u; }'
    ),
    uniformProbe(
      'group-uniforms',
      ['uniform', 'group_uniforms'],
      'group_uniforms Look;\nuniform float a = 1.0;\ngroup_uniforms Look.Fine;\nuniform float b = 2.0;\ngroup_uniforms;\nuniform float c = 3.0;\nvec3 probe() { return vec3(a, b, c); }'
    ),
  ];
}

/** Godot's refusal of each uniform it does not take, with its message and line. */
const REFUSALS = [
  ['assignment', 'uniform float u;\nfloat probe() { u = 1.0; return u; }'],
  [
    'out-argument',
    'uniform float u;\nvoid set(out float a) { a = 1.0; }\nfloat probe() { set(u); return u; }',
  ],
  ['redefinition', 'uniform float u;\nuniform int u;\nfloat probe() { return 0.0; }'],
  ['function-name', 'uniform float u;\nfloat u() { return 1.0; }\nfloat probe() { return 0.0; }'],
  ['argument-name', 'uniform float u;\nfloat probe(float u) { return u; }'],
  ['local-name', 'uniform float u;\nfloat probe() { float u = 1.0; return u; }'],
  ['nested-local-name', 'uniform float u;\nfloat probe() { { float u = 1.0; } return u; }'],
  ['void', 'uniform void u;\nfloat probe() { return 0.0; }'],
  ['struct', 'struct S { float a; };\nuniform S u;\nfloat probe() { return 0.0; }'],
  ['bool-precision', 'uniform lowp bool u;\nfloat probe() { return 0.0; }'],
  ['interpolation', 'uniform flat float u;\nfloat probe() { return 0.0; }'],
  ['no-name', 'uniform float;\nfloat probe() { return 0.0; }'],
  ['no-semicolon', 'uniform float u\nfloat probe() { return 0.0; }'],
  ['array-default', 'uniform float u[2] = 1.0;\nfloat probe() { return 0.0; }'],
  ['array-hint', 'uniform float u[2] : hint_range(0, 1);\nfloat probe() { return 0.0; }'],
  ['not-constant', 'uniform float a = 1.0;\nuniform float u = a;\nfloat probe() { return 0.0; }'],
  ['wrong-default', 'uniform vec3 u = 1.0;\nfloat probe() { return 0.0; }'],
  ['negative-to-uint', 'uniform uint u = -1;\nfloat probe() { return 0.0; }'],
  ['no-hint', 'uniform float u : 1.0;\nfloat probe() { return 0.0; }'],
  ['source-color-float', 'uniform float u : source_color;\nfloat probe() { return 0.0; }'],
  ['source-color-twice', 'uniform vec3 u : source_color, source_color;\nfloat probe() { return 0.0; }'],
  ['disabled-alone', 'uniform vec3 u : color_conversion_disabled;\nfloat probe() { return 0.0; }'],
  [
    'disabled-on-vec2',
    'uniform vec2 u : source_color, color_conversion_disabled;\nfloat probe() { return 0.0; }',
  ],
  ['range-on-vec2', 'uniform vec2 u : hint_range(0, 1);\nfloat probe() { return 0.0; }'],
  ['range-no-bracket', 'uniform float u : hint_range 0, 1;\nfloat probe() { return 0.0; }'],
  ['range-not-number', 'uniform float u : hint_range(true, 1);\nfloat probe() { return 0.0; }'],
  ['range-no-comma', 'uniform float u : hint_range(0 1);\nfloat probe() { return 0.0; }'],
  ['range-unclosed', 'uniform float u : hint_range(0, 1, 2, 3);\nfloat probe() { return 0.0; }'],
  ['range-then-enum', 'uniform int u : hint_range(0, 1), hint_enum("a");\nfloat probe() { return 0.0; }'],
  ['range-twice', 'uniform int u : hint_range(0, 1), hint_range(0, 2);\nfloat probe() { return 0.0; }'],
  ['enum-on-float', 'uniform float u : hint_enum("a");\nfloat probe() { return 0.0; }'],
  ['enum-not-string', 'uniform int u : hint_enum(a);\nfloat probe() { return 0.0; }'],
  ['enum-unclosed', 'uniform int u : hint_enum("a" "b");\nfloat probe() { return 0.0; }'],
  ['sampler-hint-on-float', 'uniform float u : hint_normal;\nfloat probe() { return 0.0; }'],
  ['filter-on-float', 'uniform float u : filter_linear;\nfloat probe() { return 0.0; }'],
  ['group-no-name', 'group_uniforms 1;\nfloat probe() { return 0.0; }'],
  ['group-close-unopened', 'group_uniforms;\nfloat probe() { return 0.0; }'],
  ['group-no-subgroup', 'group_uniforms a.;\nfloat probe() { return 0.0; }'],
  ['group-no-semicolon', 'group_uniforms a b;\nfloat probe() { return 0.0; }'],
  ['group-subgroup-no-semicolon', 'group_uniforms a.b c;\nfloat probe() { return 0.0; }'],
  ['group-close-wrong', 'group_uniforms a;\ngroup_uniforms 1;\nfloat probe() { return 0.0; }'],
  ['global-no-uniform', 'global float u;\nfloat probe() { return 0.0; }'],
  ['instance-no-uniform', 'instance float u;\nfloat probe() { return 0.0; }'],
  ['instance-matrix', 'instance uniform mat3 u;\nfloat probe() { return 0.0; }'],
  ['instance-array', 'instance uniform float u[2];\nfloat probe() { return 0.0; }'],
  ['global-array', 'global uniform float u[2];\nfloat probe() { return 0.0; }'],
  [
    'instance-index-negative',
    'instance uniform float u : instance_index(-1);\nfloat probe() { return 0.0; }',
  ],
  ['instance-index-too-big', 'instance uniform float u : instance_index(16);\nfloat probe() { return 0.0; }'],
  [
    'instance-index-twice',
    'instance uniform float u : instance_index(1), instance_index(2);\nfloat probe() { return 0.0; }',
  ],
];

function refusalProbes() {
  return REFUSALS.map(([name, source]) => uniformProbe(`refused-${name}`, [], source));
}

export const UNIFORM_PROBES = [
  ...defaultProbes(),
  ...materialValueProbes(),
  ...arrayProbes(),
  ...readProbes(),
  ...colorProbes(),
  ...hintProbes(),
  ...refusalProbes(),
];
