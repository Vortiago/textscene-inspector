/**
 * The probes of the statements: local variables and `const`, blocks, `if`, the three loops with
 * counts of 0, 1 and many, `break` and `continue` in each loop kind, `switch` with and without
 * fall-through, `discard`, a `return` inside flow, arrays and structs. Each names the rows it
 * proves.
 */

import { probeOf } from './languageProbes.mjs';

const DECLARATION = 'NODE_TYPE_VARIABLE_DECLARATION';
const BLOCK = 'NODE_TYPE_BLOCK';
const FLOW = 'NODE_TYPE_CONTROL_FLOW';
const IF = ['if', 'FLOW_OP_IF', FLOW];
const ELSE = ['else', ...IF];
const FOR = ['for', 'FLOW_OP_FOR', FLOW];
const WHILE = ['while', 'FLOW_OP_WHILE', FLOW];
const DO = ['do', 'FLOW_OP_DO', FLOW];
const BREAK = ['break', 'FLOW_OP_BREAK'];
const CONTINUE = ['continue', 'FLOW_OP_CONTINUE'];
const SWITCH = ['switch', 'case', 'FLOW_OP_SWITCH', 'FLOW_OP_CASE', FLOW];
const DEFAULT = ['default', 'FLOW_OP_DEFAULT'];
const ARRAY = ['NODE_TYPE_ARRAY', DECLARATION];
const ARRAY_CONSTRUCT = ['NODE_TYPE_ARRAY_CONSTRUCT', ...ARRAY];
const STRUCT = ['struct type', 'OP_STRUCT', 'NODE_TYPE_STRUCT'];

/** Local variables, `const`, and blocks with their scopes. */
function localProbes() {
  const cases = [
    ['local', [DECLARATION], 'vec2 probe(vec2 a) { vec2 b = a * 2.0; vec2 c; c = b + a; return c; }'],
    ['local-list', [DECLARATION], 'int probe(int a) { int b = a, c = b * 2; return b + c; }'],
    ['local-const', [DECLARATION], 'float probe(float a) { const float k = 2.5; return a * k; }'],
    ['local-const-write', [DECLARATION], 'float probe(float a) { const float k = 2.5; k = a; return k; }'],
    ['local-undeclared', [DECLARATION], 'float probe(float a) { b = a; return a; }'],
    [
      'local-twice',
      [DECLARATION],
      'float probe(float a) {\n\tfloat b = a;\n\tfloat b = 1.0;\n\treturn b;\n}',
    ],
    ['local-of-argument-name', [DECLARATION], 'float probe(float a) { float a = 1.0; return a; }'],
    ['block', [BLOCK, DECLARATION], 'int probe(int a) { int b = a; { int c = 3; b += c; } return a + b; }'],
    [
      'block-shadow',
      [BLOCK, DECLARATION],
      'int probe(int a) { int b = a; { int b = 3; a += b; } return a + b; }',
    ],
    ['block-out-of-scope', [BLOCK, DECLARATION], 'int probe(int a) {\n\t{ int c = 3; }\n\treturn a + c;\n}'],
    ['local-initialised-by-itself', [DECLARATION], 'int probe(int a) { int b = b + a; return b; }'],
  ];
  return cases.map(([word, rows, source]) => probeOf(`statement-${word}`, rows, source));
}

/** `if` with and without `else`, a chain, and the `else` that binds to the nearest `if`. */
function ifProbes() {
  const cases = [
    ['if', IF, 'float probe(float a, float b) { if (a < b) a = b; return a; }'],
    ['if-else', ELSE, 'float probe(float a, float b) { if (a < b) { a = b; } else a = -a; return a; }'],
    [
      'else-if',
      ELSE,
      'int probe(int a) { int r; if (a < 0) r = -1; else if (a == 0) r = 0; else r = 1; return r; }',
    ],
    [
      'dangling-else',
      ELSE,
      'int probe(int a, int b) { int r = 0; if (a > 0) if (b > 0) r = 1; else r = 2; return r; }',
    ],
    ['if-not-bool', IF, 'int probe(int a) { if (a) a = 1; return a; }'],
    ['if-declares', [...IF, BLOCK], 'int probe(int a) { if (a > 0) { int b = a * 2; a = b; } return a; }'],
  ];
  return cases.map(([word, rows, source]) => probeOf(`statement-${word}`, rows, source));
}

/** Each loop kind run 0, 1 and many times, by a constant count and by an argument. */
function loopCountProbes() {
  const loops = {
    for: [
      FOR,
      (count) => `int probe(int a) { for (int i = 0; i < ${count}; i++) { a = a * 3 + i; } return a; }`,
    ],
    while: [
      WHILE,
      (count) => `int probe(int a) { int i = 0; while (i < ${count}) { a = a * 3 + i; i++; } return a; }`,
    ],
    do: [
      DO,
      (count) => `int probe(int a) { int i = 0; do { a = a * 3 + i; i++; } while (i < ${count}); return a; }`,
    ],
  };
  return Object.entries(loops).flatMap(([kind, [rows, source]]) => [
    ...[0, 1, 9].map((count) => probeOf(`loop-${kind}-${count}-times`, rows, source(count))),
    probeOf(`loop-${kind}-argument-times`, rows, source('(b & 7)').replace('(int a)', '(int a, int b)')),
  ]);
}

/** A `break` and a `continue` in each loop kind, a `continue` that runs the step, and nesting. */
function breakProbes() {
  const body = 'if (i == 2) continue; if (i == 5) break; a = a * 3 + i;';
  return [
    probeOf(
      'loop-for-break-continue',
      [...FOR, ...BREAK, ...CONTINUE],
      `int probe(int a) { for (int i = 0; i < 9; i++) { ${body} } return a; }`
    ),
    probeOf(
      'loop-while-break-continue',
      [...WHILE, ...BREAK, ...CONTINUE],
      `int probe(int a) { int i = -1; while (i < 9) { i++; ${body} } return a; }`
    ),
    probeOf(
      'loop-do-break-continue',
      [...DO, ...BREAK, ...CONTINUE],
      `int probe(int a) { int i = -1; do { i++; ${body} } while (i < 9); return a; }`
    ),
    probeOf(
      'loop-do-continue-checks',
      [...DO, ...CONTINUE],
      'int probe(int a) { int i = 0; do { i++; if (i < 4) continue; a += i; } while (i < 3); return a + i; }'
    ),
    probeOf(
      'loop-for-continue-steps',
      [...FOR, ...CONTINUE],
      'ivec2 probe(int a) { int n = 0; for (int i = 0; i < 6; i += 2) { n++; continue; } return ivec2(n, a); }'
    ),
    probeOf(
      'loop-nested-break',
      [...FOR, ...WHILE, ...BREAK],
      'int probe(int a) { for (int i = 0; i < 4; i++) { int j = 0; while (true) { if (j > i) break; a = a * 2 + j; j++; } } return a; }'
    ),
    probeOf(
      'loop-nested-continue',
      [...FOR, ...CONTINUE],
      'int probe(int a) { for (int i = 0; i < 3; i++) { for (int j = 0; j < 3; j++) { if (j == i) continue; a = a * 2 + j; } } return a; }'
    ),
    probeOf('loop-break-outside', BREAK, 'int probe(int a) { break; return a; }'),
    probeOf('loop-continue-outside', CONTINUE, 'int probe(int a) { continue; return a; }'),
    probeOf(
      'loop-for-scope',
      [...FOR, DECLARATION],
      'int probe(int a) { for (int i = 0; i < 3; i++) a += i; return a + i; }'
    ),
    probeOf(
      'loop-for-empty-parts',
      [...FOR, ...BREAK],
      'int probe(int a) { int i = 0; for (;;) { if (i++ > 3) break; a += i; } return a; }'
    ),
    probeOf(
      'loop-float-counter',
      FOR,
      'float probe(float a) { for (float x = 0.5; x < 4.0; x += 1.25) a = a * 0.5 + x; return a; }'
    ),
  ];
}

/** A `return` inside an `if`, a loop and a `switch`: the statements after it never run. */
function returnProbes() {
  const cases = [
    ['return-in-if', IF, 'float probe(float a) { if (a < 0.0) return -a; a *= 2.0; return a; }'],
    [
      'return-in-loop',
      [...FOR, ...IF],
      'int probe(int a) { for (int i = 0; i < 10; i++) { if (i * i > a) return i; } return -1; }',
    ],
    [
      'return-in-nested-loop',
      [...FOR, ...WHILE],
      'int probe(int a) { for (int i = 0; i < 4; i++) { int j = 0; while (j < 4) { if (i * 4 + j == (a & 15)) return i * 10 + j; j++; } } return -1; }',
    ],
    [
      'return-in-switch',
      SWITCH,
      'int probe(int a) { switch (a & 3) { case 1: return 10; case 2: a = 0; break; } return a; }',
    ],
    // Every input reaches the return: the result of a path past the end is undefined in GLSL, and
    // WebGL sets it to zero where lavapipe in Godot picks the one value returned.
    ['return-missing-path', IF, 'int probe(int a) { if (a > 0 || a <= 0) { return 1; } }'],
  ];
  return cases.map(([word, rows, source]) => probeOf(`statement-${word}`, rows, source));
}

/** `switch` with `default`, with fall-through, on a `uint`, and inside a loop. */
function switchProbes() {
  const cases = [
    [
      'switch',
      [...SWITCH, ...DEFAULT, ...BREAK],
      'int probe(int a) { int r = 0; switch (a & 3) { case 0: r = 10; break; case 1: r = 20; break; default: r = 30; break; } return r; }',
    ],
    [
      'switch-fall-through',
      [...SWITCH, ...BREAK],
      'int probe(int a) { int r = 0; switch (a & 7) { case 0: r += 1; case 1: r += 2; break; case 2: case 3: r += 4; case 4: r += 8; } return r; }',
    ],
    [
      'switch-default-first',
      [...SWITCH, ...DEFAULT],
      'int probe(int a) { int r = 1; switch (a & 3) { default: r = 5; case 2: r *= 3; break; case 0: r = 7; } return r; }',
    ],
    [
      'switch-uint',
      [...SWITCH, ...DEFAULT, ...BREAK],
      'uint probe(uint a) { switch (a % 3u) { case 0u: a += 5u; break; case 1u: a *= 2u; break; default: a = 1u; } return a; }',
    ],
    [
      'switch-in-loop',
      [...SWITCH, ...FOR, ...BREAK, ...CONTINUE],
      'int probe(int a) { for (int i = 0; i < 5; i++) { switch (i) { case 1: continue; case 3: break; default: a = a * 2 + i; } a++; } return a; }',
    ],
    [
      'switch-scope',
      [...SWITCH, DECLARATION],
      'int probe(int a) { switch (a & 1) { case 0: int b = 3; a += b; break; case 1: { int c = 4; a += c; } } return a; }',
    ],
    [
      'switch-fall-through-ended',
      [...SWITCH, ...BREAK],
      'int probe(int a) { int r = 0; switch (a & 7) { case 0: r += 1; case 1: r += 2; break; case 2: case 3: r += 4; case 4: r += 8; break; } return r; }',
    ],
    [
      'switch-default-last',
      [...SWITCH, ...DEFAULT],
      'int probe(int a) { int r = 1; switch (a & 3) { case 2: r *= 3; break; case 0: r = 7; default: r += 5; } return r; }',
    ],
    [
      'switch-uint-ended',
      [...SWITCH, ...DEFAULT, ...BREAK],
      'uint probe(uint a) { switch (a % 3u) { case 0u: a += 5u; break; case 1u: a *= 2u; break; default: a = 1u; break; } return a; }',
    ],
    [
      'switch-in-loop-break',
      [...SWITCH, ...FOR, ...BREAK],
      'int probe(int a) { for (int i = 0; i < 5; i++) { switch (i) { case 1: a += 7; break; case 3: break; default: a = a * 2 + i; break; } a++; } return a; }',
    ],
    [
      'switch-scope-ended',
      [...SWITCH, DECLARATION, BLOCK],
      'int probe(int a) { switch (a & 1) { case 0: int b = 3; a += b; break; case 1: { int c = 4; a += c; } break; } return a; }',
    ],
    [
      'switch-case-negative',
      [...SWITCH, ...BREAK],
      'int probe(int a) { switch (a % 4) { case -3: a = 30; break; case -1: a = 10; break; case 3: a = -30; break; } return a; }',
    ],
    [
      'switch-empty-case-at-end',
      [...SWITCH, ...BREAK],
      'int probe(int a) { switch (a & 1) { case 0: a = 5; break; case 1: } return a; }',
    ],
    ['switch-twice', SWITCH, 'int probe(int a) { switch (a) { case 1: a = 0; case 1: a = 2; } return a; }'],
    ['switch-float', SWITCH, 'float probe(float a) { switch (a) { case 1: a = 0.0; } return a; }'],
    ['switch-case-variable', SWITCH, 'int probe(int a, int b) { switch (a) { case b: a = 0; } return a; }'],
    [
      'switch-case-folded',
      SWITCH,
      'int probe(int a) { switch (a & 7) { case 1 + 2: a = 0; break; case -1: a = 9; } return a; }',
    ],
  ];
  return cases.map(([word, rows, source]) => probeOf(`statement-${word}`, rows, source));
}

/** `discard`, which keeps the pixel as it was, in a branch and in a loop. */
function discardProbes() {
  return [
    probeOf(
      'statement-discard',
      ['discard', 'FLOW_OP_DISCARD', ...IF],
      'float probe(float a) { if (a < 0.0) discard; return a; }'
    ),
    probeOf(
      'statement-discard-in-loop',
      ['discard', 'FLOW_OP_DISCARD', ...FOR],
      'int probe(int a) { for (int i = 0; i < 4; i++) { if (a == i) discard; } return a; }'
    ),
  ];
}

/** Arrays: each declaration form, constructors, the initialiser list, `length()` and element writes. */
function arrayProbes() {
  const cases = [
    [
      'array',
      ARRAY_CONSTRUCT,
      'float probe(float a) { float v[3] = float[3](a, a * 2.0, 3.0); return v[0] + v[2]; }',
    ],
    [
      'array-type-first',
      ARRAY_CONSTRUCT,
      'vec2 probe(vec2 a) { vec2[2] v = vec2[](a, -a); return v[1] * v[0]; }',
    ],
    ['array-initialiser-list', ARRAY, 'int probe(int a) { int v[3] = {a, 2, a + 3}; return v[1] * v[2]; }'],
    ['array-length', ['length[array]()', ...ARRAY], 'int probe(int a) { int v[4]; return a + v.length(); }'],
    [
      'array-length-before-operator',
      ['length[array]()', ...ARRAY],
      'int probe(int a) { int v[4]; return v.length() + a; }',
    ],
    [
      'array-computed-index',
      [...ARRAY, ...FOR],
      'int probe(int a) { int v[5]; for (int i = 0; i < 5; i++) v[i] = a + i * i; return v[a & 3] + v[4]; }',
    ],
    [
      'array-swizzle-write',
      ARRAY,
      'vec2 probe(vec2 a) { vec2 v[2]; v[0] = a; v[1] = a; v[1].y = 7.0; return v[1] + v[0]; }',
    ],
    [
      'array-assign',
      ARRAY_CONSTRUCT,
      'float probe(float a) { float v[2] = float[2](a, 1.0); float w[2]; w = v; w[0] += 2.0; return w[0] + v[0]; }',
    ],
    [
      'array-size-mismatch',
      ARRAY_CONSTRUCT,
      'float probe(float a) { float v[2] = float[3](a, a, a); return v[0]; }',
    ],
    ['array-constant-index-past-end', ARRAY, 'float probe(float a) { float v[2]; v[0] = a; return v[2]; }'],
    [
      'array-const',
      ARRAY_CONSTRUCT,
      'float probe(float a) { const float v[2] = float[2](1.5, 2.5); return v[1] * a; }',
    ],
  ];
  return cases.map(([word, rows, source]) => probeOf(`statement-${word}`, rows, source));
}

/** Structs: a constructor, member reads and writes, an array member, and an array of structs. */
function structProbes() {
  const pair = 'struct Pair { float x; vec2 y; };';
  const cases = [
    ['struct', STRUCT, `${pair} vec2 probe(float a) { Pair p = Pair(a, vec2(a, 2.0)); return p.y * p.x; }`],
    [
      'struct-member-write',
      STRUCT,
      `${pair} vec2 probe(float a) { Pair p = Pair(1.0, vec2(2.0)); p.x = a; p.y.y += a; return p.y * p.x; }`,
    ],
    [
      'struct-array-member',
      [...STRUCT, ...ARRAY],
      'struct Bag { int n[3]; }; int probe(int a) { Bag b = Bag(int[3](a, 2, 3)); b.n[1] *= a; return b.n[1] + b.n[0]; }',
    ],
    [
      'struct-array',
      [...STRUCT, ...ARRAY_CONSTRUCT],
      `${pair} vec2 probe(float a) { Pair list[2] = Pair[2](Pair(a, vec2(1.0)), Pair(2.0, vec2(a))); list[1].x += a; return list[0].y + list[1].y * list[1].x; }`,
    ],
    [
      'struct-nested',
      STRUCT,
      `${pair} struct Outer { Pair p; int k; }; float probe(float a) { Outer o = Outer(Pair(a, vec2(3.0)), 2); o.p.y.x = a * 2.0; return o.p.y.x + float(o.k); }`,
    ],
    [
      'struct-assign',
      STRUCT,
      `${pair} float probe(float a) { Pair p = Pair(a, vec2(0.0)); Pair q; q = p; q.x = 1.0; return p.x + q.x; }`,
    ],
    [
      'struct-array-elements',
      [...STRUCT, ...ARRAY],
      `${pair} vec2 probe(float a) { Pair list[2]; list[0] = Pair(a, vec2(1.0)); list[1] = Pair(2.0, vec2(a)); list[1].x += a; return list[0].y + list[1].y * list[1].x; }`,
    ],
    [
      'struct-array-initialiser-list',
      [...STRUCT, ...ARRAY],
      `${pair} vec2 probe(float a) { Pair list[2] = { Pair(a, vec2(1.0)), Pair(2.0, vec2(a)) }; return list[0].y + list[1].y * list[1].x; }`,
    ],
    [
      'struct-array-unsized',
      [...STRUCT, ...ARRAY_CONSTRUCT],
      `${pair} vec2 probe(float a) { Pair list[] = Pair[](Pair(a, vec2(1.0)), Pair(2.0, vec2(a))); return list[0].y + list[1].y; }`,
    ],
    ['struct-wrong-argument', STRUCT, `${pair} float probe(float a) { Pair p = Pair(a, a); return p.x; }`],
    [
      'struct-unknown-member',
      STRUCT,
      `${pair} float probe(float a) { Pair p = Pair(a, vec2(a)); return p.z; }`,
    ],
  ];
  return cases.map(([word, rows, source]) => probeOf(`statement-${word}`, rows, source));
}

export const STATEMENT_PROBES = [
  ...localProbes(),
  ...ifProbes(),
  ...loopCountProbes(),
  ...breakProbes(),
  ...returnProbes(),
  ...switchProbes(),
  ...discardProbes(),
  ...arrayProbes(),
  ...structProbes(),
];
