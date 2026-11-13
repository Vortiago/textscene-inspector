/**
 * The probes of the rows no single operator applies: each type passed and returned, the precision
 * words, the index operator, statements, and writes through swizzles, elements and the sides of a
 * branch. Each names the rows it proves.
 */

import { PROBE_TYPES, probeSignature } from '../../../../scripts/godot-probes/probeShader.mjs';
import { argumentRows } from './inputs.mjs';

/** A probe of `source` over rows of its parameters' types. */
export function probeOf(name, rows, source) {
  const { parameters } = probeSignature(source);
  return { name, rows, source, inputs: argumentRows(parameters.map((type) => PROBE_TYPES[type])) };
}

/** Each type passed in and returned unchanged. */
function typeProbes() {
  return Object.keys(PROBE_TYPES).map((type) =>
    probeOf(
      `type-${type}`,
      [type, 'NODE_TYPE_VARIABLE', 'return', 'FLOW_OP_RETURN'],
      `${type} probe(${type} a) { return a; }`
    )
  );
}

/** Each precision word on a return type and its arguments. */
function precisionProbes() {
  return ['lowp', 'mediump', 'highp'].map((word) =>
    probeOf(
      `precision-${word}`,
      [word],
      `${word} vec2 probe(${word} vec2 a, ${word} vec2 b) { return a * b + a; }`
    )
  );
}

/** An index read and written, constant and computed, on vectors and matrices. */
function indexProbes() {
  const cases = [
    ['vector-read', 'float probe(vec4 a, int i) { return a[i & 3]; }'],
    ['vector-constant', 'int probe(ivec3 a) { return a[2]; }'],
    ['uint-index', 'bool probe(bvec4 a, uint i) { return a[i & 3u]; }'],
    ['matrix-column', 'vec3 probe(mat3 m, int i) { return m[(i & 1) + 1]; }'],
    ['matrix-lane', 'float probe(mat2 m) { return m[1][0]; }'],
    ['vector-write', 'vec4 probe(vec4 a, int i, float b) { a[i & 3] = b; return a; }'],
    ['matrix-write', 'mat2 probe(mat2 m, vec2 c, int i) { m[i & 1] = c; return m; }'],
    ['lane-write', 'mat3 probe(mat3 m, float b) { m[2][1] += b; return m; }'],
    ['member-write', 'mat2 probe(mat2 m, float b) { m[1].y = b; return m; }'],
    ['folded-read', 'float probe(vec2 a) { return a[2 - 1]; }'],
    ['folded-write', 'vec3 probe(vec3 a, float b) { a[1 + 1] = b; return a; }'],
    ['folded-past-end', 'float probe(vec2 a) { return a[1 + 5]; }'],
    ['folded-write-past-end', 'vec2 probe(vec2 a, float b) { a[1 + 5] = b; return a; }'],
  ];
  return cases.map(([word, source]) => probeOf(`index-${word}`, ['OP_INDEX'], source));
}

/** Statements before the return, the empty statement, and a statement after the return. */
function statementProbes() {
  return [
    probeOf('statement-empty', ['OP_EMPTY'], 'float probe(float a) { ; return a; }'),
    probeOf(
      'statement-sequence',
      ['NODE_TYPE_OPERATOR'],
      'ivec2 probe(ivec2 a, ivec2 b) { a += b; a *= b; return a; }'
    ),
    probeOf('statement-after-return', ['FLOW_OP_RETURN'], 'float probe(float a) { return a; return -a; }'),
    probeOf(
      'statement-tree',
      ['NODE_TYPE_CONSTANT', 'NODE_TYPE_MEMBER'],
      'float probe(vec2 a) { return a.y * 2.0; }'
    ),
  ];
}

/** Assignments through swizzles. */
function assignmentProbes() {
  const cases = [
    ['swizzle', 'vec4.xyzw', 'vec4 probe(vec4 a, vec2 b) { a.wy = b; return a; }'],
    ['swizzle-compound', 'OP_ASSIGN_MUL(ivec2,int)', 'ivec3 probe(ivec3 a, int b) { a.zx *= b; return a; }'],
    ['swizzle-step', 'OP_POST_INCREMENT(float)', 'vec3 probe(vec3 a) { a.y++; --a.z; return a; }'],
    ['swizzle-rgba', 'vec4.rgba', 'vec4 probe(vec4 a, float b) { a.g = b; a.ar = a.rg; return a; }'],
  ];
  return cases.map(([word, row, source]) => probeOf(`assign-${word}`, [row], source));
}

/** An assignment on one side of a branch: GLSL runs only the side the condition picks. */
function branchProbes() {
  const cases = [
    [
      'select',
      'OP_SELECT_IF(bool,int,int)',
      'ivec2 probe(bool c, int a, int b) { return ivec2(c ? a++ : b--, a + b); }',
    ],
    ['and', 'OP_AND(bool,bool)', 'ivec2 probe(bool c, int a) { return ivec2(c && a++ > 0 ? 1 : 0, a); }'],
    ['or', 'OP_OR(bool,bool)', 'ivec2 probe(bool c, int a) { return ivec2(c || ++a > 0 ? 1 : 0, a); }'],
  ];
  return cases.map(([word, row, source]) => probeOf(`branch-${word}`, [row], source));
}

/**
 * Godot writes an assignment and a prefix step without brackets (`shader_compiler.cpp:1132`), so
 * GLSL binds the operator beside one to its last operand, or refuses the text.
 */
function unbracketedProbes() {
  const cases = [
    ['operator-after', 'OP_ASSIGN(vec2,vec2)', 'vec2 probe(vec2 a, vec2 b) { return (a = b) * a; }'],
    ['chain', 'OP_ASSIGN(int,int)', 'int probe(int a, int b) { a = b = a + b; return a * b; }'],
    ['compound', 'OP_ASSIGN_ADD(uvec2,uvec2)', 'uvec2 probe(uvec2 a, uvec2 b) { return (a += b) ^ a; }'],
    [
      'condition',
      'OP_ASSIGN(bool,bool)',
      'bvec2 probe(bool c, bool d, bool a) { return bvec2((c = d) ? a : !a, c); }',
    ],
    ['post-step', 'OP_POST_INCREMENT(int)', 'int probe(int a, int b) { return (a = b)++ + a; }'],
    ['swizzle-of-step', 'OP_INCREMENT(float)', 'vec2 probe(vec2 a) { return vec2((++a).x, a.y); }'],
    ['operator-before', 'OP_MUL(vec2,vec2)', 'vec2 probe(vec2 a, vec2 b) { return b * (a = b); }'],
    ['negated', 'OP_NEGATE(float)', 'float probe(float a, float b) { return -(a = b); }'],
  ];
  return cases.map(([word, row, source]) => probeOf(`unbracketed-${word}`, [row], source));
}

/**
 * Godot writes a negation as its operand alone when the operand's text starts with `-`
 * (`shader_compiler.cpp:1141`), so `-(--a)` draws as `--a`.
 */
function negationTextProbes() {
  const cases = [
    ['decrement', 'OP_NEGATE(int)', 'int probe(int a) { return -(--a); }'],
    ['swizzle', 'OP_NEGATE(vec2)', 'vec2 probe(vec2 a) { return -(-a).yx; }'],
    ['element', 'OP_NEGATE(float)', 'float probe(vec2 a) { return -(-a)[1]; }'],
  ];
  return cases.map(([word, row, source]) => probeOf(`negation-text-${word}`, [row], source));
}

/**
 * glslang folds an operator of constants on the CPU, where the GPU's own arithmetic differs: a
 * shift count past 31, a division by zero, a conversion of a negative lane, an equality sized by
 * its left operand, and sums in double precision. The page reads the constant the transpiler writes.
 */
function foldingProbes() {
  const cases = [
    ['shift-past-31', 'OP_SHIFT_LEFT(uint,uint)', 'uint probe(uint a) { return (9u << 85u) ^ a; }'],
    [
      'shift-negative',
      'OP_SHIFT_RIGHT(ivec2,int)',
      'ivec2 probe(ivec2 a) { return (ivec2(-80, 80) >> -3) ^ a; }',
    ],
    [
      'uint-division-by-zero',
      'OP_DIV(uvec2,uvec2)',
      'uvec2 probe(uvec2 a) { return (uvec2(7u, 8u) / uvec2(0u, 2u)) ^ a; }',
    ],
    ['negative-int-to-uint', 'uint', 'uint probe(uint a) { return uint(-65) ^ a; }'],
    [
      'bool-to-float',
      'OP_ADD(float,float)',
      'float probe(float a) { return 98.608 + float(true) * 45.630e1 + a * 0.0; }',
    ],
    ['double-equality', 'OP_EQUAL(float,float)', 'bool probe(bool a) { return (0.1 + 0.2 == 0.3) != a; }'],
    [
      'matrix-equality',
      'OP_EQUAL(mat2,mat2)',
      'bool probe(bool a) { return (mat2(4.0) == mat2(vec2(4.0, 0.0), vec2(0.0, 4.0))) != a; }',
    ],
    [
      'matrix-times-vector',
      'OP_MUL(mat3,vec3)',
      'vec3 probe(vec3 a) { return mat3(vec3(0.1), vec3(0.2), vec3(0.7)) * vec3(0.3, 0.6, 0.9) + a * 0.0; }',
    ],
    [
      'equality-of-equalities',
      'OP_EQUAL(bool,bool)',
      'bvec2 probe(bool a) { return bvec2((vec3(76.934) == vec3(43.498)) == (1 == 2) != a, (1 == 2) == (3 == 4) != a); }',
    ],
    ['select', 'OP_SELECT_IF(bool,int,int)', 'int probe(int a) { return (1 > 2 ? 4 << 40 : 5 << 40) ^ a; }'],
  ];
  return cases.map(([word, row, source]) => probeOf(`folding-${word}`, [row], source));
}

/**
 * The expressions of constants Godot 4.6.3 ends on as it evaluates them: `mat4 * vec4` reads the
 * vector past its last lane (`shader_language.cpp:2406`), and the least `int` over -1 traps the
 * CPU (`shader_language.cpp:2245`). Each runs alone in Godot, and the transpiler refuses each.
 */
function godotEndingProbes() {
  const cases = [
    ['matrix-times-vector', 'OP_MUL(mat4,vec4)', 'vec4 probe(vec4 a) { return mat4(2.0) * vec4(1.0) + a; }'],
    ['least-int-over-minus-one', 'OP_DIV(int,int)', 'int probe(int a) { return ((1 << 31) / (0 - 1)) ^ a; }'],
  ];
  return cases.map(([word, row, source]) => ({
    ...probeOf(`ends-godot-${word}`, [row], source),
    endsGodot: true,
  }));
}

export const LANGUAGE_PROBES = [
  ...typeProbes(),
  ...precisionProbes(),
  ...indexProbes(),
  ...statementProbes(),
  ...assignmentProbes(),
  ...branchProbes(),
  ...unbracketedProbes(),
  ...negationTextProbes(),
  ...foldingProbes(),
  ...godotEndingProbes(),
];
