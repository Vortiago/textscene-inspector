/**
 * The probes of the functions a shader declares: calls from one place and from two, `in`, `out`
 * and `inout` parameters, `const` parameters, overloads, struct and array arguments and return
 * values, a `void` function through its call, an early `return`, and the forms Godot refuses,
 * recursion among them. Each names the rows it proves.
 */

import { probeOf } from './languageProbes.mjs';

const CALL = 'OP_CALL';
const VOID = ['void', CALL];
const IN = ['in', CALL];
const OUT = ['out', ...VOID];
const INOUT = ['inout', ...VOID];
const PAIR = 'struct Pair { float x; float y; };';

/** Calls of value functions: from two places, nested, from another function and in a loop. */
function callProbes() {
  const twice = 'float twice(float x) { return x * 2.0; }';
  const cases = [
    ['one-place', [CALL], `${twice} float probe(float a) { return twice(a); }`],
    ['two-places', [CALL], `${twice} float probe(float a) { return twice(a) + twice(a + 1.0); }`],
    ['nested', [CALL], `${twice} float probe(float a) { return twice(twice(a) - 1.0); }`],
    [
      'from-a-function',
      [CALL],
      `${twice} float quad(float x) { return twice(twice(x)); } float probe(float a) { return quad(a) + twice(a); }`,
    ],
    [
      'in-a-loop',
      [CALL],
      'int next(int x) { return x * 3 + 1; } int probe(int a) { int s = a; for (int i = 0; i < 4; i++) s = next(s) & 1023; return s; }',
    ],
    [
      'in-a-condition',
      [CALL],
      'bool small(int x) { return x < 50; } int probe(int a) { int s = a; while (small(s)) s += 7; return s; }',
    ],
    ['no-arguments', [CALL], 'float one() { return 1.5; } float probe(float a) { return a * one(); }'],
    [
      'vector',
      [CALL],
      'vec3 lift(vec2 v, float z) { return vec3(v, z); } vec3 probe(vec2 a, float b) { return lift(a, b) * 2.0; }',
    ],
    ['matrix', [CALL], 'mat2 turn(mat2 m) { return m * m; } mat2 probe(mat2 a) { return turn(a) + a; }'],
    ['constant-converted', [CALL], `${twice} float probe(float a) { return twice(3) + a; }`],
    [
      'argument-named-as-function',
      [CALL],
      `${twice} float probe(float a) { return twice(a); } float other(float twice) { return twice; }`,
    ],
    [
      'early-return-in-loop',
      [CALL],
      'int firstOver(int a) { for (int i = 0; i < 40; i++) { if (i * i > a) return i; } return -1; } int probe(int a) { return firstOver(a); }',
    ],
    [
      'early-return-in-branch',
      [CALL],
      'float clampUp(float x) { if (x < 0.0) return 0.0; return x * 2.0; } float probe(float a) { return clampUp(a) + clampUp(-a); }',
    ],
    [
      'value-call-as-statement',
      [CALL],
      'float kept(float x) { if (x < 0.0) discard; return x; } float probe(float a) { kept(a); return a; }',
    ],
    [
      'struct-call-as-statement',
      [CALL],
      'struct Pair { float a; float b; }; Pair kept(float x) { if (x < 0.0) discard; return Pair(x, x); } float probe(float a) { kept(a); return a; }',
    ],
    [
      'struct-return-in-branch',
      [CALL],
      'struct P { float x; float y; }; P f(float a) { if (a < 0.0) return P(-a, a); return P(a, 2.0 * a); } float probe(float a) { P p = f(a); return p.x + p.y * 3.0; }',
    ],
    [
      'array-return-in-loop',
      [CALL],
      'float[2] f(float a) { for (int i = 0; i < 3; i++) { if (a < float(i)) return float[2](a, float(i)); } return float[2](a, a); } float probe(float a) { float v[2] = f(a); return v[0] + v[1] * 10.0; }',
    ],
    [
      'vector-array-result',
      [CALL],
      'vec2[2] pair(vec2 a) { return vec2[2](a, -a); } vec2 probe(vec2 a) { vec2 p[2] = pair(a); return p[1] * 3.0 + p[0]; }',
    ],
    [
      'vector-array-out',
      OUT,
      'void fill(vec2 a, out vec2 v[2]) { v[0] = a; v[1] = a + 1.0; } vec2 probe(vec2 a) { vec2 v[2]; fill(a, v); return v[0] * v[1]; }',
    ],
    [
      'vector-array-argument',
      [CALL],
      'int second(ivec4 v[2]) { return v[1].y; } int probe(int a) { ivec4 v[2] = ivec4[2](ivec4(a), ivec4(a, a + 1, a, a)); return second(v); }',
    ],
    [
      'array-call-as-statement',
      [CALL],
      'float[2] kept(float x) { if (x < 0.0) discard; return float[2](x, x); } float probe(float a) { kept(a); return a; }',
    ],
    [
      'out-index-read-before-another-out',
      OUT,
      'void f(out int i, out float x) { i = 1; x = 2.0; } float probe(float a) { float v[2] = float[2](a, a); int k = 0; f(k, v[k]); return v[0] * 10.0 + v[1]; }',
    ],
    [
      'inout-index-read-before-an-out',
      ['inout', ...OUT],
      'void g(inout float x, out int i) { x += 1.0; i = 1; } float probe(float a) { float v[2] = float[2](a, a); int k = 0; g(v[k], k); return v[0] * 10.0 + v[1]; }',
    ],
    [
      'void-call-discards',
      VOID,
      'void keep(float x) { if (x < 0.0) discard; } float probe(float a) { keep(a); return a * 2.0; }',
    ],
  ];
  return cases.map(([word, rows, source]) => probeOf(`function-${word}`, rows, source));
}

/** `in`, `out`, `inout` and `const` parameters, and `void` functions through their calls. */
function qualifierProbes() {
  const cases = [
    ['void', VOID, 'void nothing() { } int probe(int a) { nothing(); return a; }'],
    [
      'in',
      IN,
      'float scaled(in float x) { x *= 3.0; return x; } float probe(float a) { float b = scaled(a); return a + b; }',
    ],
    [
      'in-unwritten-caller',
      IN,
      'int bumped(int x) { x += 5; return x; } int probe(int a) { int b = bumped(a); return a * 100 + b; }',
    ],
    [
      'out',
      OUT,
      'void halves(float v, out float h, out float q) { h = v * 0.5; q = v * 0.25; } float probe(float a) { float h; float q; halves(a, h, q); return h - q; }',
    ],
    [
      'out-before-read',
      OUT,
      'void seven(out int x) { x = 7; } int probe(int a) { int b = a; seven(b); return a + b; }',
    ],
    [
      'out-value-function',
      ['out', CALL],
      'float split(float v, out float rest) { rest = v - 1.0; return v + 1.0; } float probe(float a) { float r; float s = split(a, r); return s * r; }',
    ],
    [
      'inout-twice',
      INOUT,
      'void addTo(inout int x, int d) { x += d; } int probe(int a) { int s = a; addTo(s, 2); addTo(s, s); return s; }',
    ],
    [
      'inout-in-expression',
      ['inout', CALL],
      'int stepUp(inout int x) { x += 1; return x * 10; } int probe(int a) { int b = a; int c = stepUp(b) + b; return c; }',
    ],
    [
      'inout-read-after-a-writing-argument',
      INOUT,
      'void addTo(inout float x, float y) { x += y; } float probe(float a) { float b = a; addTo(b, b = 2.0); return b; }',
    ],
    [
      'inout-read-after-a-writing-argument-of-a-value-call',
      ['inout', CALL],
      'int addTo(inout int x, int y) { x += y; return x * 10; } int probe(int a) { int b = a; int c = addTo(b, b++) + b; return c; }',
    ],
    [
      'inout-vector-lane',
      INOUT,
      'void half(inout float x) { x *= 0.5; } vec2 probe(vec2 a) { vec2 v = a; half(v.y); return v; }',
    ],
    [
      'inout-array-element',
      INOUT,
      'void bump(inout int x) { x += 4; } int probe(int a) { int v[3] = int[3](a, a * 2, a * 3); int i = 1; bump(v[i]); return v[0] + v[1] * 10 + v[2] * 100; }',
    ],
    [
      'inout-struct-member',
      INOUT,
      `${PAIR} void negate(inout float x) { x = -x; } float probe(float a) { Pair p = Pair(a, 2.0); negate(p.x); return p.x + p.y; }`,
    ],
    [
      'out-struct',
      OUT,
      `${PAIR} void make(float a, out Pair p) { p = Pair(a, a * 3.0); } float probe(float a) { Pair p; make(a, p); return p.y - p.x; }`,
    ],
    [
      'out-array',
      OUT,
      'void fill(int a, out int v[2]) { v[0] = a; v[1] = a + 1; } int probe(int a) { int v[2]; fill(a, v); return v[0] * v[1]; }',
    ],
    [
      'const',
      [CALL],
      'float squared(const float x) { return x * x; } float probe(float a) { return squared(a); }',
    ],
    [
      'const-of-constant',
      [CALL],
      'float squared(const float x) { return x * x; } float probe(float a) { return squared(1.5) + a; }',
    ],
    [
      'const-in',
      IN,
      'float squared(const in float x) { return x * x; } float probe(float a) { const float k = 2.0; return squared(k) + squared(a); }',
    ],
  ];
  return cases.map(([word, rows, source]) => probeOf(`function-${word}`, rows, source));
}

/** Overloads, and struct and array arguments and return values. */
function typeProbes() {
  const cases = [
    [
      'overload-by-type',
      [CALL],
      'float f(float x) { return x + 1.0; } vec2 f(vec2 x) { return x * 2.0; } float probe(float a) { return f(a) + f(vec2(a, 1.0)).y; }',
    ],
    [
      'overload-by-count',
      [CALL],
      'int f(int x) { return x * 2; } int f(int x, int y) { return x - y; } int probe(int a) { return f(a) + f(a, 3); }',
    ],
    [
      'struct-argument',
      [CALL],
      `${PAIR} float sum(Pair p) { return p.x + p.y; } float probe(float a) { return sum(Pair(a, 2.0)); }`,
    ],
    [
      'struct-return',
      [CALL],
      `${PAIR} Pair swapped(Pair p) { return Pair(p.y, p.x); } float probe(float a) { Pair p = swapped(Pair(a, 2.0)); return p.x - p.y; }`,
    ],
    [
      'struct-return-member',
      [CALL],
      `${PAIR} Pair made(float a) { return Pair(a, -a); } float probe(float a) { return made(a).y; }`,
    ],
    [
      'array-argument',
      [CALL],
      'float sum(float v[3]) { return v[0] + v[1] + v[2]; } float probe(float a) { float v[3] = float[3](a, 2.0, 3.0); return sum(v); }',
    ],
    [
      'array-argument-type-size',
      [CALL],
      'int sum(int[2] v) { return v[0] - v[1]; } int probe(int a) { int v[2] = int[2](a, 5); return sum(v); }',
    ],
    [
      'array-argument-constructed',
      [CALL],
      'int sum(int v[2]) { return v[0] - v[1]; } int probe(int a) { return sum(int[2](a, 5)); }',
    ],
    [
      'array-argument-unchanged',
      [CALL],
      'int cleared(int v[2]) { v[0] = 0; return v[1]; } int probe(int a) { int v[2] = int[2](a, 5); int b = cleared(v); return v[0] + b; }',
    ],
    [
      'array-return',
      [CALL],
      'float[2] pair(float a) { return float[2](a, -a); } float probe(float a) { float p[2] = pair(a); return p[1] * 3.0 + p[0]; }',
    ],
    [
      'struct-array-argument',
      [CALL],
      `${PAIR} float sum(Pair v[2]) { return v[0].x + v[1].y; } float probe(float a) { Pair v[2] = { Pair(a, 1.0), Pair(2.0, a) }; return sum(v); }`,
    ],
  ];
  return cases.map(([word, rows, source]) => probeOf(`function-${word}`, rows, source));
}

/** The forms Godot refuses: recursion, an unknown or a later function, and wrong arguments. */
function refusedProbes() {
  const twice = 'float twice(float x) { return x * 2.0; }';
  const halves = 'void halves(float v, out float h) { h = v * 0.5; }';
  const cases = [
    [
      'recursion',
      [CALL],
      'int down(int a) { if (a <= 0) return 0; return down(a - 1); } int probe(int a) { return down(a); }',
    ],
    ['probe-recursion', [CALL], 'int probe(int a) {\n\tif (a > 0) return probe(a - 1);\n\treturn a;\n}'],
    [
      'later-function',
      [CALL],
      'float probe(float a) { return later(a); } float later(float x) { return x; }',
    ],
    ['unknown-function', [CALL], 'float probe(float a) {\n\treturn missing(a);\n}'],
    ['too-few', [CALL], `${twice} float probe(float a) { return twice(); }`],
    ['too-many', [CALL], `${twice} float probe(float a) { return twice(a, a); }`],
    ['wrong-type', [CALL], `${twice} float probe(int a) { return twice(a); }`],
    [
      'overload-constant',
      [CALL],
      'float f(float x) { return x; } vec2 f(vec2 x) { return x; } float probe(float a) { return f(2) + a; }',
    ],
    ['void-value', VOID, 'void nothing() { } float probe(float a) { float b = nothing(); return a; }'],
    [
      'void-return-value',
      VOID,
      'void nothing(float a) { return a; } float probe(float a) { nothing(a); return a; }',
    ],
    ['void-argument', VOID, 'float f(void x) { return 1.0; } float probe(float a) { return a; }'],
    ['out-constant', OUT, `${halves} float probe(float a) { halves(a, 1.0); return a; }`],
    ['out-expression', OUT, `${halves} float probe(float a) { halves(a, a + 1.0); return a; }`],
    [
      'out-const-local',
      OUT,
      `${halves} float probe(float a) { const float k = 1.0; halves(a, k); return a; }`,
    ],
    ['out-swizzle-twice', OUT, `${halves} float probe(vec2 a) { halves(a.x, a.xx.x); return a.x; }`],
    [
      'out-member-of-call',
      OUT,
      `${halves} vec2 pair(float a) { return vec2(a); } float probe(float a) { halves(a, pair(a).x); return a; }`,
    ],
    [
      'inout-member-of-sum',
      INOUT,
      'void half(inout float x) { x *= 0.5; } float probe(vec2 a) { half((a + a).x); return a.x; }',
    ],
    ['const-out', OUT, 'void f(const out float x) { x = 1.0; } float probe(float a) { return a; }'],
    ['const-inout', INOUT, 'void f(const inout float x) { x = 1.0; } float probe(float a) { return a; }'],
    [
      'const-write',
      [CALL],
      'float f(const float x) { x = 1.0; return x; } float probe(float a) { return f(a); }',
    ],
    ['qualifier-twice', OUT, 'void f(out in float x) { x = 1.0; } float probe(float a) { return a; }'],
    [
      'same-overload',
      [CALL],
      'float f(float x) { return x; } float f(float y) { return y; } float probe(float a) { return f(a); }',
    ],
    [
      'overload-by-return',
      [CALL],
      'float f(float x) { return x; } int f(float x) { return 1; } float probe(float a) { return f(a); }',
    ],
    [
      'local-named-as-function',
      [CALL],
      `${twice} float probe(float a) { float twice = a; return twice(a); }`,
    ],
    ['function-as-value', [CALL], `${twice} float probe(float a) { return twice; }`],
    [
      'wrong-struct',
      [CALL],
      `${PAIR} struct Other { float x; float y; }; float sum(Pair p) { return p.x; } float probe(float a) { return sum(Other(a, a)); }`,
    ],
    [
      'wrong-array-size',
      [CALL],
      'int sum(int v[2]) { return v[0]; } int probe(int a) { int v[3] = int[3](a, a, a); return sum(v); }',
    ],
    [
      'array-return-size',
      [CALL],
      'float[2] pair(float a) { return float[3](a, a, a); } float probe(float a) { return a; }',
    ],
    ['const-return', [CALL], 'const float f(float x) { return x; } float probe(float a) { return f(a); }'],
  ];
  return cases.map(([word, rows, source]) => probeOf(`function-${word}`, rows, source));
}

export const FUNCTION_PROBES = [...callProbes(), ...qualifierProbes(), ...typeProbes(), ...refusedProbes()];
