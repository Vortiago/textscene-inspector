import { SHADER_MODES } from '../../../../packages/textscene-core/src/shaders/language/instructionTable.generated.ts';

/** The processor functions of each shader type, empty, so a head alone decides the verdict. */
const EMPTY_STAGES = {
  spatial: 'void vertex() {}\nvoid fragment() {}\nvoid light() {}',
  canvas_item: 'void vertex() {}\nvoid fragment() {}\nvoid light() {}',
  particles: 'void start() {}\nvoid process() {}',
  sky: 'void sky() {}',
  fog: 'void fog() {}',
};

/** An accepted case names the head rows it proves, which Godot and the transpiler both accept. */
const headCase = (id, text, rows = []) => ({ id, text, rows });

const typeCases = () =>
  Object.entries(EMPTY_STAGES).map(([type, stages]) =>
    headCase(`type/${type}`, `shader_type ${type};\n${stages}`, [`shader_type ${type}`, 'NODE_TYPE_FUNCTION'])
  );

/** Godot's rendering server compiles no shader of a type it does not know, so it shows no message for one. */
const TYPE_REFUSALS = [
  ['type/no-semicolon', 'shader_type sky\nvoid sky() {}'],
  ['type/twice', 'shader_type sky;\nshader_type sky;'],
];

const MODE_CASES = [
  headCase('render/one', 'shader_type spatial;\nrender_mode unshaded;\nvoid fragment() {}', ['render_mode']),
  headCase('render/list', 'shader_type canvas_item;\nrender_mode unshaded, blend_add;\nvoid fragment() {}', [
    'render_mode',
  ]),
  headCase(
    'render/two-statements',
    'shader_type spatial;\nrender_mode unshaded;\nrender_mode cull_disabled;',
    ['render_mode']
  ),
  headCase('render/prefix', 'shader_type spatial;\nrender_mode unshaded_extra;'),
  headCase('render/unknown', 'shader_type spatial;\nrender_mode glow;'),
  headCase('render/duplicate', 'shader_type spatial;\nrender_mode unshaded, unshaded;'),
  headCase('render/two-values', 'shader_type spatial;\nrender_mode blend_mix, blend_add;'),
  headCase('render/no-name', 'shader_type spatial;\nrender_mode ;'),
  headCase('render/no-comma', 'shader_type spatial;\nrender_mode unshaded cull_back;'),
  headCase('render/end', 'shader_type spatial;\nrender_mode unshaded'),
  headCase('render/of-another-type', 'shader_type sky;\nrender_mode unshaded;\nvoid sky() {}'),
  headCase('render/no-head', 'render_mode unshaded;\nvoid fragment() {}'),
  headCase('stencil/one', 'shader_type spatial;\nstencil_mode read, compare_less, 5;', ['stencil_mode']),
  headCase('stencil/reference-twice', 'shader_type spatial;\nstencil_mode read, 5, 6;'),
  headCase('stencil/reference-too-big', 'shader_type spatial;\nstencil_mode read, 256;'),
  headCase('stencil/reference-negative', 'shader_type spatial;\nstencil_mode read, -1;'),
  headCase('stencil/sky', 'shader_type sky;\nstencil_mode read;\nvoid sky() {}'),
];

const CONSTANT_CASES = [
  headCase('const/scalar', 'shader_type spatial;\nconst float A = 1.5;\nvoid fragment() { float b = A; }', [
    'const',
  ]),
  headCase(
    'const/list',
    'shader_type spatial;\nconst int A = 2, B = A * 3;\nconst vec2 V[2] = { vec2(1.0), vec2(2.0) };\nvoid fragment() { float b = V[1].x * float(B); }',
    ['const']
  ),
  headCase('const/no-value', 'shader_type spatial;\nconst float A;'),
  headCase('const/not-constant', 'shader_type spatial;\nuniform float u;\nconst float A = u;'),
  headCase('const/sampler', 'shader_type spatial;\nconst sampler2D S;'),
  headCase('const/function', 'shader_type spatial;\nconst float f() { return 1.0; }'),
  headCase('const/built-in-name', 'shader_type spatial;\nconst float TIME = 1.0;'),
  headCase('const/written', 'shader_type spatial;\nconst float A = 1.0;\nvoid fragment() { A = 2.0; }'),
  headCase('global/variable', 'shader_type spatial;\nfloat a = 1.0;'),
  headCase('global/no-value', 'shader_type spatial;\nfloat a;'),
];

const STAGE_CASES = [
  headCase('stage/arguments', 'shader_type spatial;\nvoid fragment(float a) {}'),
  headCase('stage/return-type', 'shader_type spatial;\nfloat fragment() { return 1.0; }'),
  headCase('stage/called', 'shader_type spatial;\nvoid vertex() {}\nvoid fragment() {\n\tvertex();\n}'),
  headCase('stage/return', 'shader_type spatial;\nvoid fragment() {\n\treturn;\n}'),
  headCase(
    'stage/return-in-block',
    'shader_type canvas_item;\nvoid fragment() {\n\tif (true) {\n\t\treturn;\n\t}\n}'
  ),
  headCase(
    'stage/return-in-function',
    'shader_type spatial;\nvoid f() {\n\treturn;\n}\nvoid fragment() {\n\tf();\n}'
  ),
  headCase('stage/defined-twice', 'shader_type spatial;\nvoid fragment() {}\nvoid fragment() {}'),
  headCase(
    'stage/name-as-value',
    'shader_type spatial;\nvoid vertex() {}\nvoid fragment() {\n\tfloat a = vertex;\n}'
  ),
  headCase('stage/of-another-type', 'shader_type sky;\nvoid fragment(float a) {}\nvoid sky() {}'),
  headCase('discard/vertex', 'shader_type spatial;\nvoid vertex() {\n\tdiscard;\n}'),
  headCase('discard/fragment', 'shader_type spatial;\nvoid fragment() {\n\tdiscard;\n}'),
  headCase('discard/particles', 'shader_type particles;\nvoid process() {\n\tdiscard;\n}'),
  headCase('discard/sky', 'shader_type sky;\nvoid sky() {\n\tdiscard;\n}'),
  headCase(
    'discard/called-by-vertex',
    'shader_type spatial;\nvoid f() {\n\tdiscard;\n}\nvoid vertex() {\n\tf();\n}'
  ),
  headCase(
    'discard/called-twice-removed',
    'shader_type canvas_item;\nvoid f() {\n\tdiscard;\n}\nvoid g() {\n\tf();\n}\nvoid vertex() {\n\tg();\n}'
  ),
  headCase(
    'discard/called-by-fragment',
    'shader_type spatial;\nvoid f() {\n\tdiscard;\n}\nvoid fragment() {\n\tf();\n}'
  ),
  headCase('derivative/vertex', 'shader_type spatial;\nvoid vertex() {\n\tfloat d = dFdx(1.0);\n}'),
  headCase('derivative/fragment', 'shader_type spatial;\nvoid fragment() {\n\tfloat d = dFdx(1.0);\n}'),
  headCase('derivative/particles', 'shader_type particles;\nvoid process() {\n\tfloat d = fwidth(1.0);\n}'),
  headCase('derivative/fog', 'shader_type fog;\nvoid fog() {\n\tfloat d = dFdy(1.0, 2.0);\n}'),
  headCase('derivative/sky', 'shader_type sky;\nvoid sky() {\n\tfloat d = dFdx(1.0);\n}'),
  headCase(
    'derivative/called-by-vertex',
    'shader_type spatial;\nfloat f(float a) {\n\treturn dFdx(a);\n}\nvoid vertex() {\n\tfloat d = f(1.0);\n}'
  ),
  headCase(
    'derivative/after-a-varying-write',
    'shader_type spatial;\nvarying float v;\nvoid vertex() {\n\tv = 1.0;\n\tfloat d = dFdx(v);\n}'
  ),
  headCase(
    'derivative/after-a-varying-read',
    'shader_type spatial;\nvarying float v;\nvoid vertex() {\n\tfloat a = v;\n\tfloat d = dFdx(a);\n}'
  ),
  headCase(
    'derivative/varying-in-the-callee',
    'shader_type spatial;\nvarying float v;\nvoid f() {\n\tv = 1.0;\n}\nvoid vertex() {\n\tf();\n}'
  ),
  headCase(
    'derivative/unused-callee',
    'shader_type spatial;\nfloat f(float a) {\n\treturn dFdx(a);\n}\nfloat g() {\n\treturn 1.0;\n}\nvoid vertex() {\n\tfloat d = g();\n}'
  ),
  headCase(
    'stage-function/process',
    'shader_type particles;\nvoid process() {\n\tbool b = emit_subparticle(mat4(1.0), vec3(0.0), vec4(1.0), vec4(0.0), 0u);\n}'
  ),
  headCase(
    'stage-function/custom',
    'shader_type particles;\nvoid f() {\n\tbool b = emit_subparticle(mat4(1.0), vec3(0.0), vec4(1.0), vec4(0.0), 0u);\n}\nvoid process() {\n\tf();\n}'
  ),
  headCase(
    'stage-function/count',
    'shader_type canvas_item;\nvoid fragment() {\n\tfloat d = texture_sdf(vec2(0.0), 1.0);\n}'
  ),
  headCase(
    'stage-function/type',
    'shader_type canvas_item;\nvoid fragment() {\n\tfloat d = texture_sdf(vec3(0.0));\n}'
  ),
  headCase(
    'stage-function/constant',
    'shader_type canvas_item;\nvoid fragment() {\n\tfloat d = texture_sdf(1);\n}'
  ),
  headCase(
    'stage-function/vertex',
    'shader_type canvas_item;\nvoid vertex() {\n\tfloat d = texture_sdf(vec2(0.0));\n}'
  ),
  headCase(
    'stage-function/of-another-type',
    'shader_type spatial;\nvoid fragment() {\n\tfloat d = texture_sdf(vec2(0.0));\n}'
  ),
  headCase(
    'stage-function/as-value',
    'shader_type canvas_item;\nvoid fragment() {\n\tfloat d = texture_sdf;\n}'
  ),
];

const VARYING_ARGUMENT_CASES = [
  headCase(
    'varying-argument/out-before-write',
    'shader_type spatial;\nvarying float v;\nvoid set(out float a) {\n\ta = 1.0;\n}\nvoid vertex() {\n\tset(v);\n}'
  ),
  headCase(
    'varying-argument/out-in-vertex',
    'shader_type spatial;\nvarying float v;\nvoid set(out float a) {\n\ta = 1.0;\n}\nvoid vertex() {\n\tv = 0.0;\n\tset(v);\n}'
  ),
  headCase(
    'varying-argument/in-in-light',
    'shader_type spatial;\nvarying float v;\nfloat get(float a) {\n\treturn a;\n}\nvoid fragment() {\n\tv = 0.0;\n}\nvoid light() {\n\tfloat b = get(v);\n}'
  ),
  headCase(
    'varying-argument/out-in-light',
    'shader_type spatial;\nvarying float v;\nvoid set(out float a) {\n\ta = 1.0;\n}\nvoid fragment() {\n\tv = 0.0;\n}\nvoid light() {\n\tset(v);\n}'
  ),
  headCase(
    'varying-argument/built-in-out',
    'shader_type spatial;\nvarying vec2 v;\nvoid vertex() {\n\tv = vec2(0.0);\n\tvec2 f = modf(vec2(1.5), v);\n}'
  ),
];

/** A global name that Godot finds before or after a function, and a varying outside a function. */
const GLOBAL_NAME_CASES = [
  headCase(
    'global/uniform-default-reads-varying',
    'shader_type spatial;\nvarying float v;\nuniform float u = v;'
  ),
  headCase(
    'global/uniform-default-calls-with-varying',
    'shader_type spatial;\nvarying float v;\nuniform float u = abs(v);'
  ),
  headCase('global/const-size-varying', 'shader_type spatial;\nvarying float v;\nconst float c[v] = {1.0};'),
  headCase('global/function-named-as-varying', 'shader_type spatial;\nvarying vec2 f;\nvoid f() {}'),
  headCase('global/function-named-as-const', 'shader_type spatial;\nconst float f = 1.0;\nvoid f() {}'),
  headCase(
    'global/const-named-as-function',
    'shader_type spatial;\nfloat f() {\n\treturn 1.0;\n}\nconst float f = 1.0;'
  ),
  headCase('global/varying-two-sizes', 'shader_type spatial;\nvarying float[2] a[3];'),
  headCase(
    'global/varying-named-as-other-type-built-in',
    'shader_type spatial;\nvarying vec3 EYEDIR;\nvoid fragment() {}'
  ),
  headCase(
    'global/argument-named-as-const',
    'shader_type spatial;\nconst float K = 1.0;\nfloat f(float K) {\n\treturn K;\n}'
  ),
  headCase(
    'global/argument-named-as-varying',
    'shader_type spatial;\nvarying float v;\nfloat f(float v) {\n\treturn v;\n}'
  ),
  headCase('global/const-named-as-other-type-built-in', 'shader_type spatial;\nconst float EYEDIR = 1.0;', [
    'const',
  ]),
  headCase(
    'global/second-const-named-as-function',
    'shader_type spatial;\nfloat f() {\n\treturn 1.0;\n}\nconst float a = 1.0, f = 2.0;'
  ),
  headCase(
    'global/local-named-as-later-const',
    'shader_type spatial;\nfloat f() {\n\tfloat k = 1.0;\n\treturn k;\n}\nconst float k = 2.0;',
    ['const']
  ),
];

/** Each word of a mode, as a shader writes it: `blend_mix` for the option `mix` of `blend`. */
const modeWords = (mode) =>
  mode.options.length === 0 ? [mode.name] : mode.options.map((option) => `${mode.name}_${option}`);

const SHADER_TYPES = Object.keys(EMPTY_STAGES);

/** Every mode of Godot's tables in its own type, and in the next type that lacks the word. */
function tableModeCases() {
  const cases = SHADER_MODES.flatMap((mode) =>
    modeWords(mode).flatMap((word) => {
      const lacks = (type) =>
        !SHADER_MODES.some(
          (each) => each.shaderType === type && each.kind === mode.kind && modeWords(each).includes(word)
        );
      const start = SHADER_TYPES.indexOf(mode.shaderType);
      const other = [...SHADER_TYPES.slice(start + 1), ...SHADER_TYPES.slice(0, start)].find(lacks);
      const text = (type) => `shader_type ${type};\n${mode.kind} ${word};\n${EMPTY_STAGES[type]}`;
      return [
        headCase(`table/${mode.shaderType}/${mode.kind}/${word}`, text(mode.shaderType)),
        ...(other ? [headCase(`table/${other}/${mode.kind}/${word}`, text(other))] : []),
      ];
    })
  );
  return [...new Map(cases.map((each) => [each.id, each])).values()];
}

export const HEAD_CASES = [
  ...typeCases(),
  ...TYPE_REFUSALS.map(([id, text]) => headCase(id, text)),
  ...MODE_CASES,
  ...CONSTANT_CASES,
  ...STAGE_CASES,
  ...VARYING_ARGUMENT_CASES,
  ...GLOBAL_NAME_CASES,
  ...tableModeCases(),
];
