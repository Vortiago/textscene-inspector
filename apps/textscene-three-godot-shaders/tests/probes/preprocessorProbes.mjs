import { probeOf } from './languageProbes.mjs';

const CONDITION = ['#ifdef', '#endif'];

function defineProbes() {
  const cases = [
    ['object', '#define K 1.5\nfloat probe(float a) { return a * K; }'],
    ['function', '#define MIX(x, y) ((x) * 2.0 + (y))\nfloat probe(float a, float b) { return MIX(a, b); }'],
    [
      'inside-macro',
      '#define TWO 2.0\n#define TWICE(x) (x * TWO)\n#define FOUR(x) TWICE(TWICE(x))\nfloat probe(float a) { return FOUR(a) + TWO; }',
    ],
    [
      'nested-arguments',
      '#define FIRST(x, y) x\nfloat probe(float a, float b) { return FIRST(max(a, b), a); }',
    ],
    [
      'concatenation',
      '#define JOIN(x, y) x ## y\nfloat probe(float value1) { return JOIN(value, 1) * 3.0; }',
    ],
    [
      'continuation',
      '#define SUM(x, y) \\\n\t(x + \\\n\ty)\nfloat probe(float a, float b) { return SUM(a, b); }',
    ],
    ['word-boundary', '#define K 2.0\nfloat probe(float a) { float KK = a; return KK + K; }'],
    ['empty-body', '#define NOTHING\nfloat probe(float a) { return a NOTHING; }'],
    ['built-in', 'float probe(float a) { return a + float(CURRENT_RENDERER) + float(RENDERER_MOBILE); }'],
    ['redefined', '#define K 1.0\n#define K 2.0\nfloat probe(float a) { return a * K; }'],
    ['argument-count', '#define F(x, y) x\nfloat probe(float a) { return F(a); }'],
    ['concatenation-first', '#define F(x) ## x\nfloat probe(float a) { return a; }'],
    ['invalid-name', '#define 1K 2.0\nfloat probe(float a) { return a; }'],
    ['after-code', 'float probe(float a) { return a; } #define K 2.0'],
    ['space-after-hash', '# define K 2.0\nfloat probe(float a) { return a; }'],
    ['uses-49', `#define K 1.0\nfloat probe(float a) { return a${' + K'.repeat(49)}; }`],
    ['uses-50', `#define K 1.0\nfloat probe(float a) { return a${' + K'.repeat(50)}; }`],
    ['recursive', '#define K K\nfloat probe(float a) { return a + K; }'],
  ];
  return cases.map(([word, source]) => probeOf(`define-${word}`, ['#define'], source));
}

function undefProbes() {
  const cases = [
    ['redefine', '#define K 2.0\n#undef K\n#define K 3.0\nfloat probe(float a) { return a * K; }'],
    ['unknown', '#undef NEVER_DEFINED\nfloat probe(float a) { return a; }'],
    ['built-in', '#undef CURRENT_RENDERER\nfloat probe(float a) { return a; }'],
    [
      'then-ifdef',
      '#define K\n#undef K\nfloat probe(float a) {\n#ifdef K\n\treturn a;\n#endif\n\treturn -a;\n}',
    ],
  ];
  return cases.map(([word, source]) => probeOf(`undef-${word}`, ['#undef', '#define'], source));
}

function conditionProbes() {
  const cases = [
    [
      'ifdef-taken',
      [...CONDITION, '#else', '#define'],
      '#define USE\nfloat probe(float a) {\n#ifdef USE\n\treturn a + 1.0;\n#else\n\treturn a - 1.0;\n#endif\n}',
    ],
    [
      'ifdef-skipped',
      [...CONDITION, '#else'],
      'float probe(float a) {\n#ifdef USE\n\treturn a + 1.0;\n#else\n\treturn a - 1.0;\n#endif\n}',
    ],
    [
      'ifndef',
      ['#ifndef', '#endif', '#else', '#define'],
      '#define K\nfloat probe(float a) {\n#ifndef K\n\treturn a;\n#else\n\treturn a * 4.0;\n#endif\n}',
    ],
    [
      'nested',
      [...CONDITION, '#ifndef', '#else', '#define'],
      '#define A\nfloat probe(float a) {\n#ifdef A\n#ifndef B\n\ta += 1.0;\n#ifdef C\n\ta = 0.0;\n#endif\n#else\n\ta = 5.0;\n#endif\n#else\n#ifdef A\n\ta = 7.0;\n#endif\n#endif\n\treturn a;\n}',
    ],
    [
      'skipped-garbage',
      CONDITION,
      'float probe(float a) {\n#ifdef NEVER\n\tthis is not ( shading language\n#endif\n\treturn a;\n}',
    ],
    ['unmatched-endif', ['#endif'], 'float probe(float a) { return a; }\n#endif'],
    ['unmatched-else', ['#else'], '#else\nfloat probe(float a) { return a; }'],
    ['unterminated', ['#ifdef'], '#ifdef K\nfloat probe(float a) { return a; }'],
    [
      'else-twice',
      [...CONDITION, '#else'],
      '#ifdef K\n#else\n#else\n#endif\nfloat probe(float a) { return a; }',
    ],
    ['endif-text', CONDITION, '#ifdef K\n#endif K\nfloat probe(float a) { return a; }'],
    ['ifdef-text', CONDITION, '#ifdef K L\n#endif\nfloat probe(float a) { return a; }'],
    ['unknown-directive', [], '#frobnicate\nfloat probe(float a) { return a; }'],
    ['indented', CONDITION, 'float probe(float a) {\n  \t#ifdef K\n\treturn 0.0;\n  #endif\n\treturn a;\n}'],
  ];
  return cases.map(([word, rows, source]) => probeOf(`condition-${word}`, rows, source));
}

const IF = ['#if', '#endif'];

function ifProbes() {
  const body = (condition) =>
    `float probe(float a) {\n#if ${condition}\n\treturn a + 1.0;\n#endif\n\treturn a;\n}`;
  const cases = [
    ['true', IF, body('1 < 2')],
    ['false', IF, body('2 * 3 == 7')],
    ['renderer', IF, body('CURRENT_RENDERER == RENDERER_FORWARD_PLUS')],
    ['macro', [...IF, '#define'], `#define N 3\n${body('N * N > 8 && N != 4')}`],
    ['function-macro', [...IF, '#define'], `#define TWICE(x) (x * 2)\n${body('TWICE(2) == 4')}`],
    ['float', IF, body('0.5 + 0.25 == 0.75')],
    ['string', IF, body('"ab" < "b"')],
    ['vector', IF, body('Vector2(1, 2) * 2 == Vector2(2, 4)')],
    ['not', IF, body('not (1 == 2)')],
    ['zero-float', IF, body('0.0')],
    ['empty-string', IF, body('""')],
    ['empty-array', IF, body('[]')],
    ['defined-bracket', [...IF, 'defined', '#define'], `#define A\n${body('defined(A)')}`],
    ['defined-bare', [...IF, 'defined', '#define'], `#define A\n${body('defined A')}`],
    ['defined-missing', [...IF, 'defined'], body('defined(NEVER)')],
    ['defined-not', [...IF, 'defined'], body('!defined(NEVER)')],
    ['defined-two', [...IF, 'defined', '#define'], `#define A\n${body('defined(A) && defined(B)')}`],
    ['defined-bare-then-bare', [...IF, 'defined', '#define'], `#define A\n${body('defined A || defined B')}`],
    [
      'defined-bracket-then-bare',
      [...IF, 'defined', '#define'],
      `#define A\n${body('defined(A) || defined B')}`,
    ],
    ['defined-space-bracket', [...IF, 'defined', '#define'], `#define A\n${body('defined ( A )')}`],
    ['defined-compare', [...IF, 'defined'], body('defined A == 1')],
    ['defined-no-name', [...IF, 'defined'], body('defined')],
    ['defined-empty-bracket', [...IF, 'defined'], body('defined()')],
    ['defined-macro-name', [...IF, 'defined', '#define'], `#define A B\n${body('defined(A)')}`],
    ['missing-condition', IF, body('')],
    ['open-bracket', IF, body('(1 == 1')],
    ['close-bracket', IF, body('1 == 1)')],
    ['parse-error', IF, body('1 +')],
    ['unknown-name', IF, body('NEVER_DEFINED')],
    ['execute-error', IF, body('1 / 0')],
    ['modulo-zero', IF, body('1 % 0')],
    ['shift-negative', IF, body('1 << -1')],
    ['format-error', IF, body('"%d" % "a"')],
    ['error-below-root', IF, body('(1 / 0) + 1')],
    ['invalid-operands', IF, body('"a" + 1')],
    ['null', IF, body('null')],
    ['unterminated', ['#if'], '#if 1\nfloat probe(float a) { return a; }'],
    [
      'nested-skipped',
      [...IF, '#else'],
      'float probe(float a) {\n#if 0\n#if 1 +\n\ta = 0.0;\n#endif\n#else\n\ta *= 3.0;\n#endif\n\treturn a;\n}',
    ],
  ];
  return cases.map(([word, rows, source]) => probeOf(`if-${word}`, rows, source));
}

function elifProbes() {
  const chain = (first, second) =>
    `float probe(float a) {\n#if ${first}\n\treturn a + 1.0;\n#elif ${second}\n\treturn a + 2.0;\n#else\n\treturn a + 3.0;\n#endif\n}`;
  const rows = ['#elif', ...IF, '#else'];
  const cases = [
    ['taken', rows, chain('0', '1')],
    ['after-taken', rows, chain('1', '1')],
    ['none', rows, chain('0', '0')],
    ['after-taken-error', rows, chain('1', '1 +')],
    ['after-taken-missing', rows, chain('1', '')],
    ['defined', [...rows, 'defined', '#define'], `#define B\n${chain('defined(A)', 'defined(B)')}`],
    ['unmatched', ['#elif'], '#elif 1\nfloat probe(float a) { return a; }'],
    ['after-else', [...rows], '#if 0\n#else\n#elif 1\n#endif\nfloat probe(float a) { return a; }'],
    [
      'third',
      rows,
      'float probe(float a) {\n#if 0\n\ta = 1.0;\n#elif 0\n\ta = 2.0;\n#elif 2 > 1\n\ta = 3.0;\n#endif\n\treturn a;\n}',
    ],
  ];
  return cases.map(([word, probeRows, source]) => probeOf(`elif-${word}`, probeRows, source));
}

function errorProbes() {
  const cases = [
    [
      'skipped',
      ['#error', ...CONDITION],
      '#ifdef NEVER\n#error never reached\n#endif\nfloat probe(float a) { return a; }',
    ],
    ['taken', ['#error'], '#error stop here\nfloat probe(float a) { return a; }'],
  ];
  return cases.map(([word, rows, source]) => probeOf(`error-${word}`, rows, source));
}

function pragmaProbes() {
  const pragma = ['#pragma', '#pragma disable_preprocessor'];
  const cases = [
    ['disable', pragma, '#define K 2.0\n#pragma disable_preprocessor\nfloat probe(float a) { return a; }'],
    [
      'disable-then-directive',
      pragma,
      '#pragma disable_preprocessor\n#define K 2.0\nfloat probe(float a) { return a; }',
    ],
    [
      'disable-keeps-macro-text',
      pragma,
      '#define K 2.0\n#pragma disable_preprocessor\nfloat probe(float a) { return a * K; }',
    ],
    ['unknown', ['#pragma'], '#pragma optimise\nfloat probe(float a) { return a; }'],
  ];
  return cases.map(([word, rows, source]) => probeOf(`pragma-${word}`, rows, source));
}

// An include name has one text across probes, as every probe shares one project.
function includeProbe(word, source, includes, rows = ['#include']) {
  return { ...probeOf(`include-${word}`, rows, source), includes };
}

function includeProbes() {
  return [
    includeProbe(
      'nested',
      '#define SCALE 3.0\n#include "pp_nested_outer.gdshaderinc"\nfloat probe(float a) { return outer(a); }',
      {
        'pp_nested_outer.gdshaderinc':
          '#include "pp_nested_inner.gdshaderinc"\nfloat outer(float x) { return inner(x) * SCALE; }\n',
        'pp_nested_inner.gdshaderinc': 'float inner(float x) { return x + OFFSET; }\n#define OFFSET 0.25\n',
      }
    ),
    includeProbe(
      'define-across',
      '#include "pp_define_across.gdshaderinc"\nfloat probe(float a) {\n#ifdef FROM_INCLUDE\n\treturn a * FROM_INCLUDE;\n#endif\n\treturn a;\n}',
      { 'pp_define_across.gdshaderinc': '#define FROM_INCLUDE 5.0\n' },
      ['#include', ...CONDITION, '#define']
    ),
    includeProbe(
      'twice',
      '#include "pp_twice.gdshaderinc"\n#include "./pp_twice.gdshaderinc"\nfloat probe(float a) { return twice(a); }',
      { 'pp_twice.gdshaderinc': 'float twice(float x) { return x * 2.0; }\n' }
    ),
    includeProbe('cycle', '#include "pp_cycle_a.gdshaderinc"\nfloat probe(float a) { return a; }', {
      'pp_cycle_a.gdshaderinc': '#include "pp_cycle_b.gdshaderinc"\nfloat cycle_a() { return 1.0; }\n',
      'pp_cycle_b.gdshaderinc': '#include "pp_cycle_a.gdshaderinc"\nfloat cycle_b() { return 2.0; }\n',
    }),
    includeProbe(
      'missing',
      '#include "pp_never_written.gdshaderinc"\nfloat probe(float a) { return a; }',
      {}
    ),
    includeProbe(
      'missing-skipped',
      '#ifdef NEVER\n#include "pp_never_written.gdshaderinc"\n#endif\nfloat probe(float a) { return a; }',
      {},
      ['#include', ...CONDITION]
    ),
    includeProbe('no-quotes', '#include pp_twice.gdshaderinc\nfloat probe(float a) { return a; }', {}),
    includeProbe(
      'macro-in-include',
      '#define HALF(x) (x * 0.5)\n#include "pp_macro_user.gdshaderinc"\nfloat probe(float a) { return halved(a); }',
      { 'pp_macro_user.gdshaderinc': 'float halved(float x) { return HALF(x) + 1.0; }\n' },
      ['#include', '#define']
    ),
    // The outer file's macros expand over the include markers too, as Godot's do.
    includeProbe(
      'marker-expanded',
      '#define pp_marker 1\n#include "pp_marker.gdshaderinc"\nfloat probe(float a) { return marked(a); }',
      { 'pp_marker.gdshaderinc': 'float marked(float x) { return x + 1.0; }\n' },
      ['#include', '#define']
    ),
  ];
}

// Each records Godot's preprocessed text: a built-in define such as CURRENT_RENDERER needs no `#`.
export const PREPROCESSOR_PROBES = [
  ...defineProbes(),
  ...undefProbes(),
  ...conditionProbes(),
  ...ifProbes(),
  ...elifProbes(),
  ...errorProbes(),
  ...pragmaProbes(),
  ...includeProbes(),
].map((probe) => ({ ...probe, recordsPreprocessed: true }));
