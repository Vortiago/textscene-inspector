/**
 * The prose of the user guide of the transpiler: one chapter per family of instructions it
 * transpiles, one section per instruction. `renderGuide.mjs` adds what no one types by hand: the
 * rows, the probes and Godot's recorded values. A transpiled row with no section fails the build.
 */

/** The rows of the operator `op`, `OP_ADD(int,int)` and the rest. */
const operatorRows = (op) => (row) => row.id.startsWith(`${op}(`);

/** The rows of any of the operators `ops`. */
const anyOperatorRows = (ops) => (row) => ops.some((op) => row.id.startsWith(`${op}(`));

const VALUE_TYPES = new Set([
  'bool',
  'bvec2',
  'bvec3',
  'bvec4',
  'int',
  'ivec2',
  'ivec3',
  'ivec4',
  'uint',
  'uvec2',
  'uvec3',
  'uvec4',
  'float',
  'vec2',
  'vec3',
  'vec4',
  'mat2',
  'mat3',
  'mat4',
]);

const TYPES_AND_LITERALS = {
  file: 'types-and-literals.md',
  title: 'Types and literals',
  intro: `The value types of the shading language, the precision words, and the literals of each scalar type. A value of each type passes through a function and back, bit for bit.`,
  sections: [
    {
      heading: 'Value types',
      rows: (row) => row.family === 'data type' && VALUE_TYPES.has(row.id),
      what: "The scalars `bool`, `int`, `uint` and `float`, their vectors of 2 to 4 lanes (`bvec3`, `ivec2`, `uvec4`, `vec3`), and the float matrices `mat2` to `mat4`, stored column by column. An `int` holds 32 bits in two's complement, a `uint` 32 bits without a sign, and a `float` a 32-bit float.",
      tsl: 'int(a), ivec3(a), mat3(a)',
    },
    {
      heading: 'Precision words',
      rows: (row) => /^(lowp|mediump|highp)$/.test(row.id),
      what: '`lowp`, `mediump` and `highp` stand before a type. Godot refuses one on a `bool` type. Godot writes the word into its GLSL, and the probe GPU computes every precision in 32 bits, so the result equals `highp`. The transpiler keeps every value in 32 bits.',
      tsl: 'the value with no precision',
    },
    {
      heading: 'Float literals',
      rows: (row) => row.id === 'float literal',
      what: `A literal such as \`2.5\`, \`.5\`, \`1e-3\` or \`2.5f\`. Godot reads the text with its own decimal reader, keeps a 32-bit float, and writes the float back into the GLSL it compiles with 14 decimals (\`shader_compiler.cpp:180\`). So a value under \`1e-14\` draws as \`0.0\`, a value with more digits draws with fewer, and a literal past the float range, such as \`1e39\`, fails to compile. The transpiler gives each literal the float that this chain gives.

Arithmetic of literals alone, such as \`58.656 + 74.377\`, never reaches the GPU as arithmetic. Godot's GLSL compiler, glslang, folds every operator of constants on the CPU (\`Constant.cpp\`): it reads each number of Godot's text as a double, folds float arithmetic in double precision and rounds the result once. It folds integers, conversions, comparisons, swizzles, elements, matrix products and \`?:\` too, as the x86-64 build of Godot computes them. The transpiler folds the same subtrees the same way and writes the constant. So a float result can differ by one unit from the same sum in 32-bit floats, and \`9u << 85u\` is \`9u << 21u\`, where the GPU gives 0. Godot also folds a constructor of literals, and a negated literal at the top of an expression, into one constant (\`shader_language.cpp:7840\`).`,
      tsl: 'float(value)',
    },
    {
      heading: 'Integer literals',
      rows: (row) => /^(int|uint) literal$/.test(row.id),
      what: 'A decimal or `0x` literal is an `int`, and with a `u` after it a `uint`. An `int` literal past 2147483647, such as `2147483648`, `99999999999` or `0xffffffff`, is -2147483648 in Godot 4.6.3. A `uint` literal wraps past 4294967295: `4294967296u` is `0u`. A negated literal folds into one constant: `-1u` is 4294967295.',
      tsl: 'int(value), uint(value)',
    },
    {
      heading: 'Boolean literals',
      rows: (row) => /^(true|false)$/.test(row.id),
      what: '`true` and `false`, the two values of a `bool`.',
      tsl: 'bool(value)',
    },
  ],
};

const ARITHMETIC = [
  ['OP_ADD', '+', 'add', 'adds'],
  ['OP_SUB', '-', 'sub', 'subtracts'],
  ['OP_MUL', '*', 'mul', 'multiplies'],
  ['OP_DIV', '/', 'div', 'divides'],
];

const MATRIX_NOTES = {
  OP_ADD: 'A matrix and a float add lane by lane.',
  OP_SUB:
    'A matrix less a float subtracts lane by lane. three 0.187 writes `matrix - float` as `float - matrix`, so the transpiler subtracts column by column.',
  OP_MUL:
    'A matrix times a matrix or a vector is the linear algebra product: `m * v` treats `v` as a column, `v * m` as a row. A matrix times a float scales each lane. Godot 4.6.3 ends its process on `mat4 * vec4` where it knows both values, `mat4(2.0) * vec4(1.0)`: its fold reads past the vector (`shader_language.cpp:2401`). The transpiler refuses that expression with a message of its own.',
  OP_DIV:
    'A matrix divides by a matrix lane by lane. glslang writes `matrix / float` as the matrix times the reciprocal of the float, so a lane can land one unit off a true division. The transpiler does the same. Godot computes an operator of constants as it reads it (`shader_language.cpp:2065`), and refuses an `int` or `ivec` division by a zero it knows, `5 / (1 - 1)`, with "Division by zero error.". It does not check a `uvec` divisor: glslang folds a `uvec` division by a zero constant to the largest `uint`. A divisor in brackets folds, so `5 / (-0)` is refused and `5 / -0` is not. The least `int` divided by -1, both known, ends the Godot process: the transpiler refuses that expression with a message of its own.',
};

function arithmeticSection([op, token, method, verb]) {
  return {
    heading: `\`${token}\` (${op})`,
    rows: operatorRows(op),
    what: `\`a ${token} b\` ${verb} lane by lane, on \`int\`, \`uint\` and \`float\` scalars and vectors. Two vectors must have the same size and scalar type. A scalar on either side applies to every lane of the vector on the other side. An \`int\` or a \`uint\` wraps at 32 bits. ${MATRIX_NOTES[op]}`,
    tsl: `a.${method}(b)`,
  };
}

const ARITHMETIC_CHAPTER = {
  file: 'arithmetic.md',
  title: 'Arithmetic',
  intro: `The arithmetic operators on every numeric type, negation, and the steps \`++\` and \`--\`. A function of this chapter's instructions transpiles to TSL nodes that compute what Godot computes, bit for bit, on the GPU that ran the probes.

The GPU sets the edge cases, not the transpiler. On the probe GPU, a float operator reads a subnormal input as zero, negation keeps it, and \`0.0 / 0.0\` is NaN. An integer division by zero, an \`int\` \`%\` with a negative operand and a shift past 31 bits have no result GLSL defines: the probes show what the probe GPU gives, the same in Godot and in the transpilation.

What to expect: a transpiled function gives Godot's result, bit for bit, except where a GPU driver rewrites inexact float arithmetic. A driver may regroup operations or replace \`x + -x\` with \`0.0\`. Godot and the browser hand the driver different code for the same function, so a rewrite can happen on one side only. On the probe GPU, \`vec2(a0 - a2) - vec2(0.875, a2)\` at \`a0 = 16777216.0\`, \`a2 = 0.5\` gives 16777215.0 in Godot. In the browser the driver computes \`(a0 - 0.875) - a2\`, and the first lane is 16777214.0. The same function on scalars gives the same result on both sides. Most such differences are one unit in the last place. Near infinity, zero and NaN, one side can give NaN where the other gives \`-0.0\`.`,
  sections: [
    ...ARITHMETIC.map(arithmeticSection),
    {
      heading: '`%` (OP_MOD)',
      rows: operatorRows('OP_MOD'),
      what: '`a % b` is the remainder of an `int` or `uint` division, lane by lane. A float has no `%` in the shading language: `mod()` is a function. Godot refuses a remainder by a zero it knows, of every integer type, with "Modulo by zero error.".',
      tsl: 'a.mod(b)',
    },
    {
      heading: 'Negation `-a` (OP_NEGATE)',
      rows: operatorRows('OP_NEGATE'),
      what: '`-a` flips the sign of each lane, `0.0` and NaN included. An `int` wraps, so `-(-2147483648)` is -2147483648, and a `uint` negates modulo 2^32. When the text Godot writes for `a` already starts with a minus, Godot writes `a` alone (`shader_compiler.cpp:1141`). So `-(-a)` draws as `-a`, `-((-a).y)` as `-a.y`, `-(--a)` as `--a` and `-(-1.5) + b` as `-1.5 + b`. The transpiler draws them as Godot does.',
      tsl: 'a.negate()',
    },
    {
      heading: 'Steps `++a`, `--a`, `a++`, `a--`',
      rows: anyOperatorRows(['OP_INCREMENT', 'OP_DECREMENT', 'OP_POST_INCREMENT', 'OP_POST_DECREMENT']),
      what: "A step adds or takes one from every lane of an argument, a swizzle of one or an element of one. `++a` gives the new value and `a++` the old one. TSL nodes hold no state, so the transpiler keeps each argument's current value and writes the step there.",
      tsl: 'a.add(1), with the argument value replaced',
    },
  ],
};

const BITS_CHAPTER = {
  file: 'bits.md',
  title: 'Bit operators',
  intro: 'The bit operators on `int` and `uint` scalars and vectors. Each works on the 32 bits of a lane.',
  sections: [
    {
      heading: '`&`, `|` and `^` (OP_BIT_AND, OP_BIT_OR, OP_BIT_XOR)',
      rows: anyOperatorRows(['OP_BIT_AND', 'OP_BIT_OR', 'OP_BIT_XOR']),
      what: '`a & b`, `a | b` and `a ^ b` combine the bits of each lane. A scalar on either side applies to every lane of the vector on the other side.',
      tsl: 'a.bitAnd(b), a.bitOr(b), a.bitXor(b)',
    },
    {
      heading: '`~a` (OP_BIT_INVERT)',
      rows: operatorRows('OP_BIT_INVERT'),
      what: '`~a` flips every bit of each lane.',
      tsl: 'a.bitNot()',
    },
    {
      heading: '`<<` and `>>` (OP_SHIFT_LEFT, OP_SHIFT_RIGHT)',
      rows: anyOperatorRows(['OP_SHIFT_LEFT', 'OP_SHIFT_RIGHT']),
      what: '`a << b` moves the bits of each lane left by `b`, and `a >> b` right. `>>` keeps the sign of an `int` and fills a `uint` with zeros. A shift by 32 or more, or by a negative amount, has no result GLSL defines. A shift of constants folds in glslang with the count taken modulo 32, and the transpiler writes that constant.',
      tsl: 'a.shiftLeft(b), a.shiftRight(b)',
    },
  ],
};

const LOGIC_CHAPTER = {
  file: 'comparison-and-logic.md',
  title: 'Comparison and logic',
  intro: 'The comparisons, the logical operators and the conditional operator. Each gives one `bool`.',
  sections: [
    {
      heading: '`<`, `<=`, `>` and `>=`',
      rows: anyOperatorRows(['OP_LESS', 'OP_LESS_EQUAL', 'OP_GREATER', 'OP_GREATER_EQUAL']),
      what: 'Each compares two scalars of one type, `int`, `uint` or `float`. A comparison with NaN is false. Vectors compare with the functions `lessThan()` and the rest, not with these operators.',
      tsl: 'a.lessThan(b)',
    },
    {
      heading: '`==` and `!=`',
      rows: anyOperatorRows(['OP_EQUAL', 'OP_NOT_EQUAL']),
      what: '`a == b` is true when every lane is equal, and `a != b` when any lane differs, for two values of one type, matrices included. NaN equals nothing.',
      tsl: 'a.equal(b), all(equal(a, b)) for a vector',
    },
    {
      heading: '`&&`, `||` and `!`',
      rows: anyOperatorRows(['OP_AND', 'OP_OR', 'OP_NOT']),
      what: "`a && b`, `a || b` and `!a` on `bool` scalars. GLSL reads `b` only when `a` does not decide the result, so a step or an assignment inside `b` happens only then. The transpiler picks each argument's value after `b` with a select.",
      tsl: 'select(a, b, false)',
    },
    {
      heading: 'The conditional operator `c ? a : b`',
      rows: (row) => row.id.startsWith('OP_SELECT_IF(') || row.id === 'OP_SELECT_ELSE',
      what: '`c ? a : b` gives `a` when the `bool` `c` holds, and `b` otherwise. `a` and `b` have one type, any value type. GLSL runs one side, so a step or an assignment on the other side does not happen. Godot keeps a negated constant in a part as it reads it and negates the constant in place (`shader_language.cpp:7832`), so `c ? -vec2(1.0) : x` draws `vec2(1.0)` when `c` holds. The transpiler draws it as Godot does.',
      tsl: 'select(c, a, b)',
    },
  ],
};

const CONSTRUCTORS_CHAPTER = {
  file: 'constructors.md',
  title: 'Constructors and conversions',
  intro: 'The constructors of vectors and matrices, and the conversions between the scalar types.',
  sections: [
    {
      heading: 'Vector constructors',
      rows: (row) => row.family === 'constructor' && !row.returns.startsWith('mat'),
      what: "`vec3(a, b)` fills the lanes of the new vector with the lanes of its arguments, in order. One scalar argument fills every lane. The argument lanes must add up to the vector size, and have the vector's scalar type. A literal of another scalar type converts where Godot converts it: `vec2(1, 2)` is `vec2(1.0, 2.0)`.",
      tsl: 'vec3(a, b)',
    },
    {
      heading: 'Matrix constructors',
      rows: (row) => row.family === 'constructor' && row.returns.startsWith('mat'),
      what: '`mat3(a, b, c)` takes one vector per column. `mat3(f)` puts the float `f` on the diagonal and zero elsewhere. three 0.187 converts one float to a matrix as an assignment GLSL refuses, so the transpiler writes the diagonal column by column.',
      tsl: 'mat3(a, b, c)',
    },
    {
      heading: 'Scalar conversions',
      rows: (row) => row.family === 'function' && /^(int|uint|float|bool)\(/.test(row.id),
      what: '`int(a)`, `uint(a)`, `float(a)` and `bool(a)` convert one scalar. A float converts to an integer toward zero. A `bool` is 1 or 0 as a number, and a number is `true` when it is not zero.',
      tsl: 'int(a)',
    },
    {
      heading: 'The constructor operator',
      rows: (row) => row.id === 'OP_CONSTRUCT',
      what: 'Godot holds every constructor and conversion as one operator node, `OP_CONSTRUCT`, with the overload row that matched.',
      tsl: 'the constructor of the row',
    },
  ],
};

const ACCESS_CHAPTER = {
  file: 'swizzles-and-indexes.md',
  title: 'Swizzles and indexes',
  intro: 'Reading and writing lanes of vectors and columns of matrices.',
  sections: [
    {
      heading: 'Swizzles',
      rows: (row) => row.family === 'swizzle',
      what: '`a.zyx` reads the named lanes of a vector of any scalar type, in any order, repeated or not, up to four. The letters come from one set: `xyzw`, `rgba` or `stpq`. Godot refuses a mix such as `a.xg`, and a letter past the vector, such as `.z` on a `vec2`. A swizzle with no letter twice can be assigned to: `a.zx = b` writes two lanes.',
      tsl: 'a.zyx',
    },
    {
      heading: 'Indexes `a[i]`',
      rows: (row) => row.id === 'OP_INDEX',
      what: '`a[i]` reads lane `i` of a vector or column `i` of a matrix, where `i` is an `int` or a `uint`. Godot refuses a constant index past the end. An index the shader computes past the end has no result GLSL defines. `a[i] = b` writes the lane or column.',
      tsl: 'a.element(i)',
    },
  ],
};

const ASSIGNMENT_CHAPTER = {
  file: 'assignments.md',
  title: 'Assignments',
  intro: `Assignments to a function's arguments, their swizzles and their elements. Godot lets a function assign its arguments. Local variables come with the statements slice (#1824).

TSL nodes hold no state, so the transpiler keeps each argument's current value and writes each assignment there. Godot writes an assignment without brackets into its GLSL (\`shader_compiler.cpp:1132\`), so GLSL binds the operator beside an assignment to the assignment's value: Godot draws \`(a = b) * a\` as \`a = (b * a)\`, and fails to compile \`b * (a = b)\`. The transpiler reads the text as GLSL does and refuses what GLSL refuses.`,
  sections: [
    {
      heading: '`=` (OP_ASSIGN)',
      rows: operatorRows('OP_ASSIGN'),
      what: '`a = b` writes `b` to `a` and gives the new value. A chain `a = b = c` writes `c` to both.',
      tsl: 'the argument value replaced by b',
    },
    {
      heading: 'Compound assignments',
      rows: (row) => /^OP_ASSIGN_\w+\(/.test(row.id),
      what: '`a += b`, `a -= b`, `a *= b`, `a /= b`, `a %= b`, `a <<= b`, `a >>= b`, `a &= b`, `a |= b` and `a ^= b` apply the operator to `a` and `b` and write the result to `a`. `v *= m` multiplies a vector by a matrix on the right.',
      tsl: 'the argument value replaced by a.add(b)',
    },
  ],
};

const STATEMENTS_CHAPTER = {
  file: 'statements.md',
  title: 'Functions and statements',
  intro:
    "The statements of a function body this slice reads, and the nodes of Godot's tree that its expressions use. Local variables, `if`, loops and the other statements come with the statements slice (#1824).",
  sections: [
    {
      heading: '`return`',
      rows: (row) => row.id === 'return' || row.id === 'FLOW_OP_RETURN',
      what: "`return a;` ends the function with the value `a`, of the function's return type. Godot refuses a non-void function with no `return`. A statement after the first `return` never runs.",
      tsl: 'the value of the first return',
    },
    {
      heading: 'Expression statements and `;`',
      rows: (row) => row.id === 'OP_EMPTY',
      what: 'An expression and a `;` before the `return` runs for its assignments and steps. A `;` alone is an empty statement.',
      tsl: 'nothing for `;`',
    },
    {
      heading: 'Tree nodes',
      rows: (row) => /^NODE_TYPE_(VARIABLE|CONSTANT|OPERATOR|MEMBER)$/.test(row.id),
      what: "Godot's tree holds an argument read as a variable node, a literal or a folded constant as a constant node, an operator as an operator node and a swizzle as a member node (`shader_language.h:372`). The transpiler's tree has the same nodes, each with its file, line and column.",
      tsl: 'one TSL node per tree node',
    },
  ],
};

export const GUIDE_CHAPTERS = [
  TYPES_AND_LITERALS,
  ARITHMETIC_CHAPTER,
  BITS_CHAPTER,
  LOGIC_CHAPTER,
  CONSTRUCTORS_CHAPTER,
  ACCESS_CHAPTER,
  ASSIGNMENT_CHAPTER,
  STATEMENTS_CHAPTER,
];
