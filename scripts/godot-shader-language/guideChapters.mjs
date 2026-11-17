import { isFunctionRow } from '../../packages/textscene-core/src/shaders/language/instructionFamily.ts';

/** The rows of the operator `op`, `OP_ADD(int,int)` and the rest. */
const operatorRows = (op) => (row) => row.id.startsWith(`${op}(`);

/** The rows of any of the operators `ops`. */
const anyOperatorRows = (ops) => (row) => ops.some((op) => row.id.startsWith(`${op}(`));

/** The rows of the built-in functions `names`, `sin(vec2)` and the rest. */
const functionRows = (names) => (row) =>
  isFunctionRow(row) && names.some((name) => row.id.startsWith(`${name}(`));

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

Arithmetic of literals alone, such as \`58.656 + 74.377\`, never reaches the GPU as arithmetic. Godot's GLSL compiler, glslang, folds every operator of constants on the CPU (\`Constant.cpp\`): it reads each number of Godot's text as a double, folds float arithmetic in double precision and rounds the result once. It folds integers, conversions, comparisons, swizzles, elements, matrix products, a matrix of another matrix, \`?:\` and most built-in calls too, as the x86-64 build of Godot computes them. The transpiler folds the same subtrees the same way and writes the constant. So a float result can differ by one unit from the same sum in 32-bit floats, and \`9u << 85u\` is \`9u << 21u\`, where the GPU gives 0. Godot also folds a constructor of literals, and a negated literal at the top of an expression, into one constant (\`shader_language.cpp:7840\`).`,
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

The GPU sets the edge cases, not the transpiler. On the probe GPU, a float operator reads a subnormal input as zero, negation keeps it, and \`0.0 / 0.0\` is NaN. An integer division by zero, an \`int\` \`%\` with a negative operand and a shift by a count past 31 or under 0 have no result GLSL defines. The probes show what the probe GPU gives, the same in Godot and in the transpilation. A shift of a variable by a negative count can still differ, because no fold sets its result: the two sides reach the driver through different compilers, and each gives its own answer. On the probe GPU and one input, \`a0 << ~18\` gives 0 in Godot and \`0xffffffac\` in the browser.

What to expect: a transpiled function gives Godot's result, bit for bit, except where a GPU driver rewrites inexact float arithmetic. A driver may regroup operations or replace \`x + -x\` with \`0.0\`. Godot and the browser hand the driver different code for the same function, so a rewrite can happen on one side only. On the probe GPU, \`vec2(a0 - a2) - vec2(0.875, a2)\` at \`a0 = 16777216.0\`, \`a2 = 0.5\` gives 16777215.0 in Godot. In the browser the driver computes \`(a0 - 0.875) - a2\`, and the first lane is 16777214.0. The same function on scalars gives the same result on both sides. Most such differences are one unit in the last place. Near infinity, zero and NaN, one side can give NaN where the other gives \`-0.0\`.

Godot 4.6.3 ends, and runs no shader, on two expressions of constants: \`mat4 * vec4\`, which its evaluation reads past the vector's last lane (\`shader_language.cpp:2406\`), and the least \`int\` divided by -1, which traps the CPU (\`shader_language.cpp:2245\`). The transpiler refuses each with \`Godot 4.6.3 aborts on this expression\` and the cause. The same operators on a variable, or \`mat3 * vec3\` of constants, transpile.`,
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
      rows: (row) => isFunctionRow(row) && /^(int|uint|float|bool)\(/.test(row.id),
      what: '`int(a)`, `uint(a)`, `float(a)` and `bool(a)` convert one scalar. A float converts to an integer toward zero. A `bool` is 1 or 0 as a number, and a number is `true` when it is not zero.',
      tsl: 'int(a)',
    },
    {
      heading: 'Vector and matrix conversions',
      rows: (row) => isFunctionRow(row) && /^(?:[biu]?vec\d|mat\d)\(/.test(row.id),
      what: '`ivec3(a)` converts each lane of a vector of the same size, as the scalar conversions do. `mat3(m)` takes the upper left of a larger matrix, or puts a smaller one in the upper left of the identity matrix.',
      tsl: 'ivec3(a), mat3(m)',
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
    "The statements of a function body: local variables, blocks, `if`, the three loops, `switch`, `discard` and `return`, with arrays and structs, and the nodes of Godot's tree that hold them. Before the emitter, tree-to-tree lowerings rewrite each loop as `while (true)`, a `switch` as an `if` chain, and a `return` inside flow as a write of the result. Godot runs the printed text of each lowered tree, so each lowering is checked by Godot itself.",
  sections: [
    {
      heading: '`return`',
      rows: (row) => row.id === 'return' || row.id === 'FLOW_OP_RETURN',
      what: "`return a;` ends the function with the value `a`, of the function's return type. Godot refuses a non-void function with no `return`. A `return` inside a branch or a loop is lowered to a write of the result, a flag and a `break` from each loop around it.",
      tsl: "the `Fn`'s value: the lowered function's one `return`, the last statement",
    },
    {
      heading: 'Expression statements and `;`',
      rows: (row) => row.id === 'OP_EMPTY',
      what: 'An expression and a `;` before the `return` runs for its assignments and steps. A `;` alone is an empty statement.',
      tsl: 'nothing for `;`',
    },
    {
      heading: 'Local variables and `const`',
      rows: (row) => row.id === 'NODE_TYPE_VARIABLE_DECLARATION',
      what: "`float b = a;` declares a local variable, and `int b = a, c = 2;` declares several. A variable without a value holds what GLSL leaves undefined until a write. `const float k = 2.5;` declares a constant, which Godot refuses to write. Godot refuses a name declared twice in one function, an argument's name included, and a variable read in its own initialiser.",
      tsl: 'a TSL `Var` that starts at its value',
    },
    {
      heading: 'Blocks',
      rows: (row) => row.id === 'NODE_TYPE_BLOCK',
      what: '`{ ... }` runs its statements in order and opens a scope: a variable declared in it is gone after it. A block may declare a name of the block around it.',
      tsl: 'its statements, in order',
    },
    {
      heading: '`if` and `else`',
      rows: (row) => /^(if|else|FLOW_OP_IF|NODE_TYPE_CONTROL_FLOW)$/.test(row.id),
      what: '`if (c) s1 else s2` runs `s1` when `c` holds and `s2` when it does not. The condition must be a `bool`. An `else` belongs to the nearest `if` without one.',
      tsl: '`If(c, ...).Else(...)`',
    },
    {
      heading: 'Loops',
      rows: (row) => /^(for|while|do|FLOW_OP_(FOR|WHILE|DO))$/.test(row.id),
      what: '`for (init; c; step) s`, `while (c) s` and `do s while (c);` run `s` while `c` holds: `do` runs it once before the first test. A variable declared in `init` is gone after the loop. Each part of `for` may be empty, and an empty condition holds.',
      tsl: '`Loop(...)` over the lowered `while (true)`, with `if (!c) break;` inside',
    },
    {
      heading: '`break` and `continue`',
      rows: (row) => /^(break|continue|FLOW_OP_(BREAK|CONTINUE))$/.test(row.id),
      what: '`break` leaves the innermost loop or `switch`. `continue` goes to the next test of the innermost loop, and in a `for` it runs the step first. Godot refuses `continue` inside a `switch` and either word outside a loop.',
      tsl: '`Break()` and `Continue()`',
    },
    {
      heading: '`switch`',
      rows: (row) => /^(switch|case|default|FLOW_OP_(SWITCH|CASE|DEFAULT))$/.test(row.id),
      what: '`switch (a)` runs from the `case` whose integer constant equals `a`, or from `default`, until a `break`: a case without one falls through to the next. In Godot 4.6.3 a case without `break` that ends the `switch` takes the statements after the `switch` too, so Godot refuses such a function for its missing `return`.',
      tsl: '`If` chain in a `Loop` that runs once, over the lowered `switch`',
    },
    {
      heading: '`discard`',
      rows: (row) => /^(discard|FLOW_OP_DISCARD)$/.test(row.id),
      what: '`discard` drops the fragment: its pixel keeps what it held. It is allowed in a function the fragment function calls.',
      tsl: '`Discard()`',
    },
    {
      heading: 'Arrays',
      rows: (row) => /^(NODE_TYPE_ARRAY|NODE_TYPE_ARRAY_CONSTRUCT|length\[array\]\(\))$/.test(row.id),
      what: '`float v[3]` and `float[3] v` declare an array, `float[3](a, b, c)` and `float[](a, b, c)` construct one, and `{a, b, c}` initialises one. `v.length()` is the size. An index Godot folds out of range is refused.',
      tsl: '`array(...)` in a `Var`, its elements by `element(i)`',
    },
    {
      heading: 'Structs',
      rows: (row) => /^(struct|struct type|OP_STRUCT|NODE_TYPE_STRUCT)$/.test(row.id),
      what: '`struct Pair { float x; vec2 y; };` declares a struct before the functions. `Pair(a, b)` constructs one from a value of each member, in order, and `p.x` reads or writes a member.',
      tsl: 'one `Var` per member, and one array per member for an array of structs',
    },
    {
      heading: 'Tree nodes',
      rows: (row) => /^NODE_TYPE_(VARIABLE|CONSTANT|OPERATOR|MEMBER)$/.test(row.id),
      what: "Godot's tree holds an argument read as a variable node, a literal or a folded constant as a constant node, an operator as an operator node and a swizzle as a member node (`shader_language.h:372`). The transpiler's tree has the same nodes, each with its file, line and column.",
      tsl: 'one TSL node per tree node',
    },
  ],
};

const FUNCTIONS_CHAPTER = {
  file: 'functions.md',
  title: 'Functions and calls',
  intro:
    "The functions a shader declares and the calls between them: parameters with `in`, `out`, `inout` and `const`, overloads, struct and array arguments and return values, and `void` functions. Each function of the shader becomes one GLSL function, as in the GLSL Godot writes, through a TSL `Fn` with a layout. TSL's functions take values only, so an `out` or `inout` value goes back to the caller in a struct the function returns. A function called from 64 places is 10,430 characters of GLSL in this form, against 270,552 when each call site holds its own copy of the body.",
  sections: [
    {
      heading: 'Calls and overloads',
      rows: (row) => row.id === 'OP_CALL',
      what: '`f(a, b)` calls a function declared before the call. Godot picks the function of the argument types and sizes, and converts a scalar constant to the parameter type only when the function has no overload. A second function of one name must differ in its argument types: Godot names it `f@2` in its tree. Godot refuses recursion, a call of a function declared later, and arguments of no overload, with the message that names each candidate.',
      tsl: 'a call of the TSL `Fn` of the function, one GLSL function for each overload',
    },
    {
      heading: '`in`, `out` and `inout`',
      rows: (row) => /^(in|out|inout)$/.test(row.id),
      what: "An `in` parameter, the default, is a copy of the caller's value, which the function may change. An `out` parameter starts undefined, and the caller's variable takes its last value when the function returns. An `inout` parameter does both. An `out` or `inout` argument must be a variable, an array element or a member that is not of a constant, and Godot refuses a constant or an expression there. A `const` parameter takes any value and refuses a write.",
      tsl: "the `out` and `inout` values in a struct the GLSL function returns, written back to the caller's places in order",
    },
    {
      heading: '`void`',
      rows: (row) => row.id === 'void',
      what: 'A `void` function returns no value: it acts through its `out` and `inout` parameters and `discard`. Its call stands as a statement, and Godot refuses it as a value.',
      tsl: 'a GLSL function of type `void`, or of the struct of its `out` and `inout` values',
    },
  ],
};

/** The probes of the built-in chapter: each overload on inputs, not a call of constants. */
const isOverloadProbe = (probe) => !/^(fold|gpu)-call-/.test(probe.name);

/** The built-in functions whose call of constants glslang folds (`Constant.cpp`). */
const FOLDED_FUNCTIONS = [
  'radians',
  'degrees',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'pow',
  'exp',
  'log',
  'exp2',
  'log2',
  'sqrt',
  'inversesqrt',
  'abs',
  'sign',
  'floor',
  'trunc',
  'round',
  'roundEven',
  'ceil',
  'fract',
  'mod',
  'min',
  'max',
  'clamp',
  'mix',
  'step',
  'smoothstep',
  'isnan',
  'isinf',
  'length',
  'distance',
  'dot',
  'cross',
  'normalize',
  'reflect',
  'refract',
  'faceforward',
  'outerProduct',
  'lessThan',
  'greaterThan',
  'lessThanEqual',
  'greaterThanEqual',
  'equal',
  'notEqual',
  'any',
  'all',
  'not',
];

/** The built-in functions of values whose call of constants glslang leaves to the GPU. */
const GPU_FUNCTIONS = [
  'sinh',
  'cosh',
  'tanh',
  'asinh',
  'acosh',
  'atanh',
  'matrixCompMult',
  'transpose',
  'determinant',
  'inverse',
];

const FOLDING_CHAPTER = {
  file: 'folding.md',
  title: 'Calls of constants',
  intro: `A call of a built-in function whose arguments are all constants, such as \`sin(vec2(1.5))\`, never reaches the GPU in Godot. glslang, the GLSL compiler of Godot, folds the call on the CPU in double precision and rounds the result to a float once (\`Constant.cpp\`). The transpiler folds the same calls with the same formulas (\`glslangCalls.ts\`) and writes the result as a TSL constant node. A call that reads a parameter or a variable is not folded on either side.

glslang has its own formulas, and the transpiler keeps them: \`round(-2.5)\` is -2, \`sign(-0.0)\` is +0, \`sign\` of NaN is 1, \`min(NaN, 1.0)\` is NaN, and \`lessThanEqual\` of NaN is true. A fold rounds once from double precision, where the GPU rounds after each step, so \`length(vec3(0.1, 0.2, 0.3))\` and \`degrees(1.2345)\` differ from the GPU in the last bit.

The browser's compiler folds some of these calls itself, to the same bits, so the probe of such a call is equal without the transpiler's fold too. The transpiler folds every call glslang folds, because another browser's compiler can fold it otherwise or not at all.`,
  sections: [
    {
      heading: 'Calls glslang folds',
      rows: functionRows(FOLDED_FUNCTIONS),
      what: 'glslang folds a call of constants of each of these functions, of floats, ints, uints and bools, and of a scalar argument that stands for every lane. The derivatives `dFdx`, `dFdy` and `fwidth` fold to 0. Each probe holds values where the fold and the GPU give different bits, or an edge where glslang has its own formula.',
      tsl: 'float(0.5235987755982988)',
      probes: (probe) => probe.name.startsWith('fold-call-'),
    },
    {
      heading: 'Calls glslang leaves to the GPU',
      rows: functionRows(GPU_FUNCTIONS),
      what: "glslang folds no call of the hyperbolic functions, `matrixCompMult`, `transpose`, `determinant` or `inverse`, so the GPU computes them. One side's compiler can fold such a call instead, and two kinds of difference follow. Inside the domain, the fold differs from the GPU in the last bits: Godot's driver folds `sinh` and `cosh`, the browser's compiler folds `tanh`, `acosh`, `atanh` and `inverse`, and both fold `asinh`, to other values. Outside the domain, or near the float range, the browser's compiler folds the call to a number where the GPU gives NaN or infinity: `atanh(92.167)`, `acosh(0.866)` and the inverse of a singular matrix to 0, and `cosh(89.152)` to a finite value. Each probe of a constant has a probe of the same value through the parameter, such as `sinh(a + 0.899)` on the input 0. No compiler can fold that one, so it gives the GPU's value on both sides and is bit-equal.",
      tsl: 'sinh(a)',
      probes: (probe) => probe.name.startsWith('gpu-call-'),
    },
  ],
};

const BUILT_IN_FUNCTIONS_CHAPTER = {
  file: 'built-in-functions.md',
  title: 'Built-in functions',
  intro: `The built-in functions of every shader type that compute on values: the trigonometric, hyperbolic, exponential, common, geometric, matrix and vector relational functions of Godot's \`builtin_func_defs\`. Godot writes each call into its GLSL as the GLSL function of the same name. The transpiler builds the three/tsl node of the same function, and a composite of TSL nodes for the seven forms three/tsl has no function for: \`roundEven\`, \`modf\`, \`isnan\`, \`isinf\`, \`matrixCompMult\`, \`outerProduct\` and \`mix\` with a \`bvec\` blend. A probe of each overload draws it on zero, negative, large, NaN and infinite inputs, and \`pnpm test:shaders:gpu\` compares the bits with Godot's.

Godot picks the first overload in its table whose argument types fit. A scalar constant converts to the argument type where Godot converts it: \`max(a, 1)\` with a \`float\` \`a\` is \`max(a, 1.0)\`. Godot refuses a whole array as an argument and arguments of no overload, with the message \`Invalid arguments for the built-in function\`. A built-in name calls the built-in, before any function of the shader. The out argument of \`modf\` must be a variable, an array element or a member that is not of a constant.

A call of constants alone never reaches the GPU in Godot: glslang folds it on the CPU, and [Calls of constants](folding.md) shows how the transpiler does the same.

Two forms differ from Godot, each with its cause in \`tests/probes/knownProbeDifferences.mjs\`. \`min\`, \`max\` and \`clamp\` of a vector and a float give +0 for a -0 or a subnormal lane where Godot keeps it, in 1 to 3 lanes of a probe. Godot leaves the out argument of \`modf\` unwritten when nothing reads the call's value.`,
  sections: [
    {
      heading: 'Angles and trigonometry',
      rows: functionRows(['radians', 'degrees', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan']),
      what: '`radians` and `degrees` convert an angle, and `sin`, `cos`, `tan`, `asin`, `acos` and `atan` work in radians, lane by lane. `atan(y, x)` gives the angle of the point `(x, y)`, from -π to π.',
      tsl: 'sin(a)',
      probes: isOverloadProbe,
    },
    {
      heading: 'Hyperbolic functions',
      rows: functionRows(['sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh']),
      what: '`sinh`, `cosh`, `tanh` and their inverses `asinh`, `acosh` and `atanh`, lane by lane.',
      tsl: 'sinh(a)',
      probes: isOverloadProbe,
    },
    {
      heading: 'Exponential functions',
      rows: functionRows(['pow', 'exp', 'log', 'exp2', 'log2', 'sqrt', 'inversesqrt']),
      what: '`pow(x, y)`, `exp`, `log`, `exp2`, `log2`, `sqrt` and `inversesqrt`, lane by lane. GLSL leaves the result of `pow` of a negative `x`, `log` of a negative value and `sqrt` of a negative value undefined, so the probe shows what the GPU gives.',
      tsl: 'pow(a, b)',
      probes: isOverloadProbe,
    },
    {
      heading: 'Rounding and the parts of a float',
      rows: functionRows([
        'abs',
        'sign',
        'floor',
        'trunc',
        'round',
        'roundEven',
        'ceil',
        'fract',
        'mod',
        'modf',
      ]),
      what: '`abs` and `sign` of a float or an int, and `floor`, `trunc`, `round`, `roundEven`, `ceil` and `fract`. `mod(x, y)` is `x - y * floor(x / y)`. `modf(x, whole)` returns the fraction of `x` and writes its whole part to `whole`, a place the call writes as an `out` argument. three/tsl has neither, so the transpiler builds `roundEven` lane by lane as `floor(x) + mod(floor(x), 2)` at a half and `round(x)` elsewhere, and `modf` as `trunc(x)` into the place and `x - trunc(x)` as the result.',
      tsl: 'floor(a)',
      probes: isOverloadProbe,
    },
    {
      heading: 'Limits and blends',
      rows: functionRows(['min', 'max', 'clamp', 'mix', 'step', 'smoothstep']),
      what: "`min`, `max` and `clamp` of floats, ints and uints, with a scalar second and third argument for a vector. `mix(a, b, t)` blends by a float or a vector `t`, and by a `bvec` `t` picks each lane of `b` where `t` is true. three's `mix` casts a `bvec` to a float, so the transpiler builds that form as a `select` for each lane. `step(edge, x)` is 0 under the edge and 1 from it, and `smoothstep` blends between two edges on a cubic curve.",
      tsl: 'clamp(a, b, c)',
      probes: isOverloadProbe,
    },
    {
      heading: 'NaN and infinity',
      rows: functionRows(['isnan', 'isinf']),
      what: '`isnan(x)` is true for a NaN lane, and `isinf(x)` for an infinite lane. three/tsl has neither, so the transpiler builds `isnan(x)` as `notEqual(x, x)` and `isinf(x)` as `equal(abs(x), infinity)`.',
      tsl: 'notEqual(x, x)',
      probes: isOverloadProbe,
    },
    {
      heading: 'Geometric functions',
      rows: functionRows([
        'length',
        'distance',
        'dot',
        'cross',
        'normalize',
        'reflect',
        'refract',
        'faceforward',
      ]),
      what: '`length`, `distance`, `dot` and `cross` of vectors, `normalize`, and the reflection of a direction from a normal, `reflect(i, n)`, its refraction by a ratio, `refract(i, n, eta)`, and `faceforward(n, i, nref)`, `n` turned to face away from `i`.',
      tsl: 'dot(a, b)',
      probes: isOverloadProbe,
    },
    {
      heading: 'Matrix functions',
      rows: functionRows(['matrixCompMult', 'outerProduct', 'transpose', 'determinant', 'inverse']),
      what: '`matrixCompMult(a, b)` multiplies element by element, `outerProduct(c, r)` gives the matrix whose column `j` is `c * r[j]`, and `transpose`, `determinant` and `inverse` of a square matrix. GLSL leaves the inverse of a singular matrix undefined. three/tsl has no `matrixCompMult` or `outerProduct`, so the transpiler builds each column from TSL nodes.',
      tsl: 'inverse(m)',
      probes: isOverloadProbe,
    },
    {
      heading: 'Vector relational functions',
      rows: functionRows([
        'lessThan',
        'greaterThan',
        'lessThanEqual',
        'greaterThanEqual',
        'equal',
        'notEqual',
        'any',
        'all',
        'not',
      ]),
      what: '`lessThan`, `greaterThan`, `lessThanEqual`, `greaterThanEqual`, `equal` and `notEqual` compare lane by lane and give a `bvec`. `any` is true when a lane is true, `all` when every lane is, and `not` inverts each lane.',
      tsl: 'lessThan(a, b)',
      probes: isOverloadProbe,
    },
  ],
};

const BIT_FUNCTIONS_CHAPTER = {
  file: 'bit-functions.md',
  title: 'Integer, bit and derivative functions',
  intro: `The built-in functions of Godot's \`builtin_func_defs\` that read the bits of a value, pack and unpack, count and move bits, give carries and wide products, split a float into its fraction and exponent, and take a derivative. Godot marks most of them \`high_end\`: its Compatibility renderer refuses each with the message \`Built-in function "%s(%s)" is only supported on high-end platforms.\` (\`shader_language.cpp:3657\`), and Forward+ and Mobile pass them to the GPU. GLSL ES 3.0, which WebGL 2 runs, has the bits of a float, the 2x16 packs and the plain derivatives. The transpiler builds each other function from the integer and float operations GLSL ES 3.0 has, to the bits GLSL 4.50 defines.

\`fma\` and the coarse and fine derivatives have no exact form in GLSL ES 3.0, so the transpiler draws each with its nearest form, on WebGL 2 only: \`fma(a, b, c)\` as \`a * b + c\`, and \`dFdxCoarse\` and \`dFdxFine\` as \`dFdx\`, and so on for \`dFdy\` and \`fwidth\`. WebGPU has the exact functions, but three's TSL does not expose them. On the test driver every probe of these forms is bit-equal with Godot, so the difference below could not be shown there.`,
  sections: [
    {
      heading: 'The bits of a float',
      rows: functionRows(['floatBitsToInt', 'floatBitsToUint', 'intBitsToFloat', 'uintBitsToFloat']),
      what: '`floatBitsToInt` and `floatBitsToUint` give the bits of each float lane as an int or a uint, and `intBitsToFloat` and `uintBitsToFloat` give the float of the bits.',
      tsl: 'floatBitsToUint(a)',
    },
    {
      heading: 'Pack and unpack',
      rows: functionRows([
        'packHalf2x16',
        'packUnorm2x16',
        'packSnorm2x16',
        'packUnorm4x8',
        'packSnorm4x8',
        'unpackHalf2x16',
        'unpackUnorm2x16',
        'unpackSnorm2x16',
        'unpackUnorm4x8',
        'unpackSnorm4x8',
      ]),
      what: 'Each pack function writes the lanes of a vector into one uint, as 16-bit halves or as 16-bit or 8-bit fixed-point values, and each unpack function reads them back. GLSL ES 3.0 has no 4x8 forms, so three writes a GLSL function of its own for each.',
      tsl: 'packHalf2x16(a)',
    },
    {
      heading: 'Bit counts and bit fields',
      rows: functionRows([
        'bitCount',
        'findLSB',
        'findMSB',
        'bitfieldReverse',
        'bitfieldExtract',
        'bitfieldInsert',
      ]),
      what: '`bitCount` counts the set bits of each lane, `findLSB` and `findMSB` give the index of the lowest and highest set bit or -1 for none, and `findMSB` of a negative int gives its highest clear bit. `bitfieldReverse` reverses the bits, `bitfieldExtract(value, offset, bits)` reads a field of `bits` bits from `offset`, with its sign for an int, and `bitfieldInsert(base, insert, offset, bits)` writes one. GLSL leaves a field past bit 31, or a negative offset or count, undefined, so the transpiler gives no promise for one. Random programs draw an offset and a count of 0 to 16 each, and the probes check the defined edges: the whole word (offset 0, 32 bits), the top bit (offset 31, 1 bit) and an empty field at the top (offset 32, 0 bits).',
      tsl: 'shiftRight(shiftLeft(shiftRight(value, offset), room), room)',
    },
    {
      heading: 'Carries and wide products',
      rows: functionRows(['uaddCarry', 'usubBorrow', 'umulExtended', 'imulExtended']),
      what: '`uaddCarry(x, y, carry)` gives the wrapped sum and writes 1 to `carry` where it wrapped, and `usubBorrow` does the same for a difference. `umulExtended(x, y, msb, lsb)` and `imulExtended` write the high and the low 32 bits of the 64-bit product, and give nothing, so a program calls them as a statement and reads `msb` and `lsb` after it. The transpiler builds the high half from products of 16-bit halves.',
      tsl: 'add(x, y), lessThan(sum, x)',
    },
    {
      heading: 'Fused multiply-add',
      rows: functionRows(['fma']),
      what: "`fma(a, b, c)` gives `a * b + c`. GLSL gives it the precision of `a * b + c`, and a GPU may round the product before the sum or not. GLSL ES 3.0 has no `fma`, so on WebGL 2 the transpiler writes `a * b + c`, which the driver may fuse. Godot's `fma` on the test driver rounds twice, as `a * b + c` does there, so the probe is bit-equal on rows built to tell the two roundings apart.",
      tsl: 'add(mul(a, b), c)',
    },
    {
      heading: 'Fraction and exponent',
      rows: functionRows(['frexp', 'ldexp']),
      what: "`frexp(x, exponent)` gives the fraction of `x`, from 0.5 to 1 in size, and writes its exponent, so that `x` is the fraction times 2 to the exponent. `ldexp(x, exponent)` gives `x` times 2 to the exponent. Godot lists the exponent of `ldexp` as an out argument, so it must be a variable, though the call only reads it. GLSL leaves `frexp` of an infinity or a NaN, and an `ldexp` past the float range, undefined. The transpiler splits a subnormal from its bits, so a GPU that reads subnormals as zero still gives the fraction and exponent GLSL defines: 1e-40 is `0.545 * 2^-132`. Godot's test driver gives the unnormalised bits `0x3f0116c2` with exponent 0, a listed difference. `ldexp` gives GLSL's value from -278 to 277: `ldexp(3e38, -253)` is `0x00e1b1e6`, where Godot's test driver gives 0. At -252, -251 and -250 both sides are equal. The inferred cause, not read from Mesa's source, is a split of the exponent into halves that flushes 2^-127. It is a listed difference.",
      tsl: 'uintBitsToFloat(sign | fraction << shift | 0x3f000000)',
    },
    {
      heading: 'Derivatives',
      rows: functionRows([
        'dFdx',
        'dFdy',
        'fwidth',
        'dFdxCoarse',
        'dFdxFine',
        'dFdyCoarse',
        'dFdyFine',
        'fwidthCoarse',
        'fwidthFine',
      ]),
      what: "`dFdx` and `dFdy` give the difference of a value between neighbouring pixels across and down the screen, and `fwidth` the sum of their sizes. A GPU computes them for each block of 2 by 2 pixels: a coarse derivative takes one difference for the block, and a fine one a difference for each row or column. GLSL ES 3.0 has only the plain forms, which the GPU runs as either, so on WebGL 2 the coarse and fine forms draw as the plain ones. Godot's driver on the test machine runs coarse as fine, so the probes cannot show it. On a 16 by 16 target of `x * x * (y + 0.37)`, a true coarse `dFdx` in the second row of a block is 1.74 where the fine one is 3.74. A probe draws one row of pixels, so `dFdy` is 0 on both sides. The browser's compiler, ANGLE, writes each derivative as `dFdx * r.x + dFdy * r.y` for its screen rotation (`RewriteDfdy.cpp`), so a -0, infinite or NaN neighbour gives +0 or NaN where Godot gives -0, infinity or 0.",
      tsl: 'dFdx(a)',
    },
  ],
};

const SKY_CHAPTER = {
  file: 'sky.md',
  title: 'Sky shaders',
  intro:
    "A shader of `shader_type sky` draws a 3D view's background. Godot links it into its sky template, `environment/sky.glsl`: the shader's `sky()` fills the template's code slot, each built-in reads as the template's GLSL for it, and each name of the shader takes Godot's `m_` id. The transpiler links the shader the same way, then transpiles both stages of the template to TSL on a triangle that covers the view. `writeSkyBindings` writes the template's uniforms from the camera, the fog and the directional lights, and `SKY_BINDINGS` names the line of Godot's C++ behind each one.",
  sections: [
    {
      heading: '`COLOR`',
      rows: (row) => row.id === 'sky.sky.COLOR',
      what: "`COLOR` is the colour `sky()` writes, linear. Godot's sky template holds it in its local `color`, and writes it to the frame after the environment's brightness and fog.",
      tsl: "the template's local `color`",
    },
    {
      heading: '`TIME`',
      rows: (row) => row.id === 'sky.global.TIME',
      what: "`TIME` is the shader time in seconds. Godot adds each frame's step to it before the frame draws, in a double, and wraps it at the project setting `rendering/limits/time/time_rollover_secs`, 3600 by default. `ShaderClock` keeps the same sum and wrap: `advance(step)` before each frame, then `writeSkyBindings({ time })`. In the previewer, `PlaybackShaderTime` moves it with the playback controls instead: play advances it, pause holds it, a scrub sets it to the playhead, and stop sets it to 0. A scene with no AnimationPlayer advances it every frame, as Godot does.",
      tsl: "the template's uniform `params.time`, which `writeSkyBindings` writes as a float",
    },
    {
      heading: '`EYEDIR`',
      rows: (row) => row.id === 'sky.sky.EYEDIR',
      what: "`EYEDIR` is the unit direction from the camera through the pixel, in world space. Godot's template unprojects the pixel at the far plane with the camera's inverse projection, turns it by the camera's orientation and normalises it (`sky.glsl:211-223`).",
      tsl: "the template's local `cube_normal`",
    },
    {
      heading: '`SKY_COORDS`',
      rows: (row) => row.id === 'sky.sky.SKY_COORDS',
      what: "`SKY_COORDS` is the panorama's uv of `EYEDIR`: x from the angle about Y, y from the angle down from +Y, each from 0 to 1. Godot computes the angles with its own approximations of `atan2` and `acos` (`sky.glsl:178-232`), and the transpiler runs the same approximations.",
      tsl: "the template's local `panorama_coords`",
    },
    {
      heading: '`SCREEN_UV` and `FRAGCOORD`',
      rows: (row) => row.id === 'sky.sky.SCREEN_UV' || row.id === 'sky.sky.FRAGCOORD',
      what: "`SCREEN_UV` is the pixel's place in the view, from 0 to 1, and `FRAGCOORD` is the pixel's window coordinate. Godot's `SCREEN_UV` is the template's `uv`, which it derives from the triangle's `uv_interp` (`sky.glsl:204`).",
      tsl: "the template's local `uv`, and `screenCoordinate` for `gl_FragCoord`",
    },
    {
      heading: '`POSITION`',
      rows: (row) => row.id === 'sky.global.POSITION',
      what: "`POSITION` is the camera's position in world space. `writeSkyBindings` writes it from the camera's world matrix, as `sky.cpp` writes `params.position` from the camera transform.",
      tsl: "the template's uniform `params.position`",
    },
    {
      heading: '`PI`, `TAU` and `E`',
      rows: (row) => /^sky\.constants\./.test(row.id),
      what: 'Godot writes each constant into the shader as the text of `String::num` of its C++ value (`sky.cpp:755-757`): 3.14159265358979, 6.28318530717959 and 2.71828182845905. The transpiler reads the same text as a float.',
      tsl: 'a float constant',
    },
    {
      heading: '`ALPHA`',
      rows: (row) => row.id === 'sky.sky.ALPHA',
      what: "`ALPHA` starts at 1 and goes to the frame's alpha (`sky.glsl:235`, `:274`). Godot draws the sky with no blending, so `ALPHA` changes no colour of an opaque view.",
      tsl: "the template's local `alpha`",
    },
    {
      heading: '`FOG`',
      rows: (row) => row.id === 'sky.sky.FOG',
      what: "`FOG` starts at `vec4(0.0)`. After the scene's fog, Godot mixes the sky's colour toward `FOG.rgb` by `FOG.a` when `FOG.a` is above 0 (`sky.glsl:238`, `:297-298`). `disable_fog` turns off both.",
      tsl: "the template's local `custom_fog`",
    },
    {
      heading: 'Render modes',
      rows: (row) => row.id === 'sky render_mode disable_fog' || row.id === 'sky render_mode use_debanding',
      what: "`disable_fog` defines `DISABLE_FOG`, which skips the scene's fog and `FOG` (`sky.glsl:279-301`). `use_debanding` defines `USE_DEBANDING`, which adds Godot's interleaved gradient noise of the pixel's window coordinate to the colour (`sky.glsl:313-314`).",
      tsl: 'the defines of the template variant',
    },
  ],
};

const HEAD_CHAPTER = {
  file: 'head.md',
  title: 'The shader head and the processor functions',
  intro:
    "A shader opens with `shader_type`, then holds render modes, stencil modes, uniforms, varyings, constants, structs and functions in any order. The processor functions are the functions Godot calls itself: `vertex()`, `fragment()` and `light()` of `spatial` and `canvas_item`, `start()` and `process()` of `particles`, `sky()` and `fog()`. Each one links into a slot of the type's template. A text with no head is read as Godot reads a `canvas_item`, which is how the probes run. The parser keeps Godot's rules and messages for every form below, and a set of whole shaders checks them against Godot's verdicts.",
  sections: [
    {
      heading: 'The shader type',
      rows: (row) => /^shader_type( \w+)?$|^NODE_TYPE_SHADER$/.test(row.id),
      what: "`shader_type spatial;` names the type: `spatial`, `canvas_item`, `particles`, `sky` or `fog`. Godot refuses a second head and a head with no `;`, at the line of the type. The type decides which processor functions, built-ins, stage functions, render modes and stencil modes the shader has. Godot's rendering server compiles no shader of a type it does not know, so it shows no message for one. The transpiler refuses it with the message of Godot's shader editor.",
      tsl: 'the functions of the shader, which the template of the type links: the sky template now, and the others with their own slices',
    },
    {
      heading: 'Processor functions',
      rows: (row) => row.id === 'NODE_TYPE_FUNCTION',
      what: 'A processor function takes no arguments and returns `void`, and Godot refuses it once it is defined twice. No call reaches it, and its name is no value. Godot refuses `return` anywhere in it. `discard` stands only in `fragment()` and `light()` of `spatial` and `canvas_item`, and in the other functions of those two types. `vertex()` may not reach a derivative function, a stage function or `discard`, in its own body or in a function it calls. A varying that `vertex()` writes before such a use lets the use pass, as in Godot. `particles` and `fog` refuse the derivatives in every function. A stage function such as `texture_sdf` or `emit_subparticle` takes its exact argument types, with no conversion of a constant.',
      tsl: 'a TSL `Fn` for each function, which the template calls in its stage',
    },
    {
      heading: 'Render modes',
      rows: (row) => row.id === 'render_mode',
      what: '`render_mode unshaded, cull_disabled;` lists modes of the shader type, and a shader may have more than one `render_mode` line. Godot finds a mode by the start of its name, so `unshaded_extra` reads as `unshaded`. Godot refuses a mode of another type, a mode given twice, and two values of one mode such as `blend_mix` and `blend_add`. Each mode is a row of its own, with the template that reads it and the issue that binds it.',
      tsl: 'nothing in the functions: the template of the type reads the modes',
    },
    {
      heading: 'Stencil modes',
      rows: (row) => row.id === 'stencil_mode',
      what: '`stencil_mode read, compare_less, 5;` lists the stencil modes of a `spatial` shader and one reference value, from 0 to 255. Godot refuses a second reference value, a value past 255, and a stencil mode in another type.',
      tsl: 'nothing in the functions: the template of the type reads the modes',
    },
    {
      heading: 'Global constants',
      rows: (row) => row.id === 'const',
      what: '`const float A = 1.5, B = A * 2.0;` outside a function declares constants that every function reads. Each value must be a constant expression, and Godot refuses a sampler, a missing value, a write, and the name of a built-in of the type. A global variable without `const` is refused. GLSL folds a global constant as it folds a local one, so the emitter writes each constant at the start of every function.',
      tsl: 'a TSL `Var` at the start of each function, which starts at its value',
    },
  ],
};

const directiveRows = (ids) => (row) => ids.includes(row.id);

const PREPROCESSOR_CHAPTER = {
  file: 'preprocessor.md',
  title: 'Preprocessor and includes',
  intro: `Godot runs its preprocessor on a shader's text before it parses it (\`shader_preprocessor.cpp\`), and the transpiler runs a port of it (\`preprocessor/\`). The preprocessor removes the comments, reads each \`#\` line, writes only the taken branches and expands the macros. Every line keeps its number, so an error names the line of the original text.

When the preprocessor refuses a text, a game does not show the preprocessor's message: \`Shader::set_code\` hands the text unchanged to the compiler, which refuses it at its first \`#\` with \`Tokenizer: Unknown character #35: '#'\`. The transpiler does the same, so its refusal is Godot's.

A caller passes \`ShaderOptions\` to \`transpileShadingLanguage\` and \`transpileSky\`: \`file\`, the shader's \`res://\` path, \`readInclude\`, which answers the text of a \`.gdshaderinc\` file by its path, and \`renderingMethod\`, the project's \`rendering/renderer/rendering_method\`. \`CURRENT_RENDERER\` is 2 for \`forward_plus\`, 1 for \`mobile\` and 0 for \`gl_compatibility\`, and \`forward_plus\` when the caller gives none.

\`decoders\` lends the Zstandard and Brotli decoders that \`decompress\` in an \`#if\` needs. The package imports only three.js, so an app that needs them installs \`fzstd\` or \`brotli\` and passes their \`decompress\`:

\`\`\`js
import { decompress as zstd } from 'fzstd';
import { decompress as brotli } from 'brotli/decompress';

transpileShadingLanguage(code, { decoders: { zstd, brotli } });
\`\`\`

\`pnpm godot:probes\` records the text Godot's preprocessor makes of each probe of this chapter, and a test checks that the port makes the same text, byte for byte. The random programs hold no directive.`,
  sections: [
    {
      heading: 'Macros',
      rows: directiveRows(['#define', '#undef']),
      what: "`#define` makes a macro, with or without arguments, and `#undef` removes one. At the end of each line, each macro in name order replaces its first use, pass after pass, until a pass replaces none. So a macro inside a macro expands, and Godot refuses a line that uses one macro 50 times, as the 51st pass ends the expansion with an error. A body stands between two spaces, `##` joins the words either side, and a `\\` at a line's end continues the body. A macro made after a line of an include still expands in that line, because the including file expands the include's text again. Godot refuses a second `#define` of one name and `#undef` of `CURRENT_RENDERER` and the other built-in defines.",
      tsl: 'none: the preprocessor writes shading language text',
      probes: (probe) => /^(define|undef)-/.test(probe.name),
    },
    {
      heading: 'Conditions',
      rows: directiveRows(['#ifdef', '#ifndef', '#else', '#endif']),
      what: '`#ifdef` and `#ifndef` take their branch when a macro is or is not defined, and `#else` takes the other. A skipped branch is not read, so it can hold any text. Godot refuses text after a name, a second `#else`, an `#endif` with no condition and a condition with no `#endif`.',
      tsl: 'none: the preprocessor writes the taken branch',
      probes: (probe) => probe.name.startsWith('condition-'),
    },
    {
      heading: '`#if`, `#elif` and `defined`',
      rows: directiveRows(['#if', '#elif', 'defined']),
      what: '`#if` and `#elif` take their branch when the condition is true, and an `#elif` only when no branch before it was taken. Godot first replaces each `defined NAME` and `defined(NAME)` with `true` or `false`, then expands the macros, then runs the text with its Expression class, which the transpiler ports (`godot/expression/`). So a condition can use every Variant operator and constructor, such as `Vector2(1, 2) * 2 == Vector2(2, 4)`. A value is true when it is not its type\'s zero: `0.0`, `""` and `[]` are false. Godot evaluates an `#elif` after a taken branch too, so its errors still show. A failed operation still leaves a value: `1 / 0` leaves the text `Division by zero error`, so `#if 1 / 0` is true, and only a failure that leaves Nil, such as `"a" + 1`, is refused with `Condition evaluation error.`. Godot keeps the end of the last `defined` operand for a bare name at the end of the text, so `defined(A) || defined B` becomes `true || falsefined B`, which Godot refuses with `Condition evaluation error.`. A condition can call the utility functions too, such as `abs`, `lerp`, `max` and `type_convert`, which the transpiler ports from `variant_utility.cpp` (`godot/variant/utility/`). A refused argument still leaves the value the function returns: `floor("x")` leaves a text, so `#if floor("x")` is true. A random draw is Godot\'s only after a `seed` earlier in the same shader, because the editor seeds its generator from the clock: `#if str(seed(5))` then `#if randi() == 3066015881` is true, and a draw before any seed is refused with its row and #1828. `hash` gives Godot\'s `Variant::hash` of every type, so `#if hash("abc") == 193485963` is true. `var_to_str` writes Godot\'s text of every type, typed arrays and dictionaries included, such as `Array[int]([1])`. `str_to_var` reads Godot\'s text of every type, so `#if str_to_var("Vector2(1, 2)").x == 1` is true. An `Object(...)` of a class Godot can make and a `Resource(...)` of a file that `readInclude` finds make a Godot object. The transpiler stops on these with a message that it does not support them yet, and #1953. A class Godot can make is one a game run can make: the editor\'s own classes, such as `EditorDock`, give null. The transpiler cannot read the project\'s uid cache, so a `Resource(...)` of a uid with no file found by its path stops with #1815, even where Godot knows no such uid and gives null. An `Object(...)` of a class Godot cannot make, a `Resource(...)` of a file that `readInclude` does not find, and a parse fault give null, as in Godot. `var_to_bytes` and `bytes_to_var`, with their `_with_objects` forms, write and read Godot\'s bytes of every type, NaN sign bits included. `bytes_to_var` stops the same way on an object id other than 0 and on an object of a class Godot can make, after it reads the properties. It refuses a Signal whose object id is not 0, as `instance_from_id` does. A NodePath holds its names and subnames, as Godot does, so a name read from bytes that holds `/` makes a NodePath other than the one of that text. A condition can read a member or an index, as Godot\'s `Variant::get` does: `Vector2(1, 2).y`, `Color(1, 0, 0).ok_hsl_s`, `"abc"[-1]` and `{"a": 1}["a"]`. A method name read as a member gives Godot\'s bound Callable, such as `Vector2::length`. `weakref` of null or of an object makes a WeakRef object and stops the same way. `weakref` of another type fails Godot\'s argument check. A condition can call a method of the math types (the vectors, Rect2, Rect2i, Color, Plane, AABB, Quaternion, Basis, Transform2D, Transform3D and Projection), as Godot\'s `Variant::callp` does, such as `Vector3(1, 2, 3).cross(Vector3(0, 1, 0))`, in float as Godot\'s `real_t` is. It can call a method of String, StringName and NodePath too, such as `"a,b".split(",").size() == 2` and `"1e3".is_valid_float()`, with Godot\'s own case tables, number spelling and text encodings. A missing argument takes its default. A wrong count of arguments leaves null, so the condition is refused with `Condition evaluation error.`. An argument of a wrong type fails Godot\'s check, but the method still runs on the cast value and leaves it: `Vector2(1, 2).dot("a")` leaves `0.0`. These String calls are refused with their row and #1828, and the shader is not transpiled: `to_multibyte_char_buffer`, because Godot converts with the iconv of the machine it runs on, for an empty encoding name and for a named one; `humanize_size`, because Godot translates its unit into the language of the editor or the game; and a call that makes a String JavaScript cannot hold, which is a code past U+10FFFF, a high surrogate followed by a low one, or a text longer than V8\'s longest string. The message names the condition and the reason, such as `\'#if "a".to_multibyte_char_buffer("UTF-16").size() > 0: to_multibyte_char_buffer, which converts with the iconv of the machine Godot runs on\' is not transpiled yet (#1828)`. A condition can call a method of Array, Dictionary and the ten packed arrays too, such as `[3, 1, 2].max() == 3` and `PackedByteArray([0, 60]).decode_half(0) == 1.0`. A method Callable keeps its base, as Godot\'s shared array does, so `[1, 1, 1].map(PackedByteArray([1, 1]).erase)` gives `[true, true, false]`. `push_back` and `append` of a packed array give `false` on success, as Godot gives its error code as a bool. A sort and a binary search compare as Godot\'s `operator<` does, part by part for a vector or a Color. A typed array refuses a value of another type, as Godot does. A condition can call a method of Callable, Signal and RID too. `bind`, `bindv` and `unbind` wrap a Callable as Godot does, so `[3].has.unbind(2).call(3, 4, 5)` is true, and two binds of one Callable are equal when they bind as many values. A Callable keeps the hash its base had when it was made. A Signal and a Callable have no Object here, so `connect` gives `3` and `rpc` is a call error, as in Godot without an Object. These calls are refused with their row and #1828, and the shader is not transpiled: `pick_random` and `shuffle` before a `seed`, because the editor seeds its generator from the clock; `get_string_from_multibyte_char` of a non-empty array, because Godot converts with the iconv of the machine it runs on; `get_string_from_utf16` of a high surrogate before a unit that is not a surrogate, because Godot then reads memory it never wrote; and `compress`, because the transpiler only decompresses. `decompress` and `decompress_dynamic` read FastLZ with a port of Godot\'s FastLZ, Deflate and GZIP through fflate with the header and checksum checks of zlib, Zstandard and Brotli through the decoders the app lends in `ShaderOptions.decoders`. So `PackedByteArray([5, 104, 101, 108, 108, 111, 32, 224, 9, 5, 4, 119, 111, 114, 108, 100]).decompress(29, 0).get_string_from_ascii()` is `"hello hello hello hello world"`. A stream that fails a check gives an empty array, as in Godot. Zstandard or Brotli with no decoder lent is refused with a message that names the package to install. These are refused with their row and #1828: a buffer too large for this transpiler to allocate in Zstandard or Brotli mode, because whether Godot can allocate it depends on the machine; a FastLZ buffer under 16 bytes that FastLZ fills less of, and a FastLZ stream that reads past its end, because Godot then reads memory it never wrote; `decompress_dynamic` of a Deflate or GZIP stream with bytes after its end, where Godot never returns, unless its output fills its last 16384-byte chunk exactly or a full chunk passes the maximum; and `decompress_dynamic` of a Brotli stream that ends early, where Godot never returns. `rid_allocate_id`, and `instance_from_id` of an id other than 0, answer from the running editor and are refused. A condition that ends Godot with SIGFPE, such as `(-9223372036854775807 - 1) / -1`, is refused.',
      tsl: 'none: the preprocessor writes the taken branch',
      probes: (probe) => /^(if|elif)-/.test(probe.name),
    },
    {
      heading: '`#error` and `#pragma`',
      rows: directiveRows(['#error', '#pragma', '#pragma disable_preprocessor']),
      what: '`#error` refuses the shader, unless it stands in a skipped branch. `#pragma disable_preprocessor` stops the preprocessor: the rest of the text goes to the compiler as it is, so a later `#` line is refused and a macro is not expanded. Godot knows no other pragma.',
      tsl: 'none',
      probes: (probe) => /^(error|pragma)-/.test(probe.name),
    },
    {
      heading: '`#include`',
      rows: directiveRows(['#include']),
      what: "`#include \"path\"` puts the preprocessed text of a `.gdshaderinc` file in place, between the markers `@@>path` and `@@<path`, which the tokenizer reads to name the include's file and lines in an error. A relative path is relative to the shader's folder. The defines of an include stay for the text after it. A file is included once. Godot refuses a missing file, a cycle and a chain deeper than 25. It finds a cycle by the hash of a file's text, so two files of the same text count as one. An include in a skipped branch is not read.",
      tsl: 'none: the preprocessor writes the included text',
      probes: (probe) => probe.name.startsWith('include-'),
    },
  ],
};

const uniformProbes = (pattern) => (probe) =>
  probe.name.startsWith('uniform-') && pattern.test(probe.name.slice(8));

const UNIFORMS_CHAPTER = {
  file: 'uniforms.md',
  title: 'Uniforms',
  intro: `A uniform is a value the material gives the shader. \`transpileShadingLanguage\` and \`transpileSky\` give back \`parameters\`, one per uniform by name, and \`set\` takes the value as \`ShaderMaterial.set_shader_parameter\` takes it, a Godot Variant. \`textToVariant\` reads one from the text a \`.tres\` or \`.tscn\` file holds:

\`\`\`js
const shader = transpileShadingLanguage('uniform vec4 tint : source_color;\\nvec4 probe() { return tint; }');
shader.parameters.get('tint').set(textToVariant('Color(1, 0.5, 0, 1)'));
\`\`\`

\`set(undefined)\` gives back Godot's own value. The transpiler fills each uniform as Godot's \`update_uniform_buffer\` does (\`material_storage.cpp:741\`): it converts the value to the uniform's type as \`_fill_std140_variant_ubo_value\` does, and a default as \`_fill_std140_ubo_value\` does. A uniform the material does not set reads the shader's default. With no default, a \`source_color\` \`vec3\` or \`vec4\` reads opaque black, a matrix reads the identity, and everything else reads zero. An array element the value has no whole element for reads zero, or the identity for a matrix.

Godot's \`p_use_linear_color\` decides whether a colour goes to linear. It is true for every material but a \`canvas_item\` one, which converts only in a viewport with \`use_hdr_2d\`. \`TranspileOptions.useLinearColor\` sets it for \`transpileShadingLanguage\`, and a sky always converts (\`sky.cpp:193\`). The probes run both ways.

An array reaches the shader as the bits of one \`uvec4\` per column, as std140 lays it out, and the shader reads each lane back from its bits. So a float array whose first value is NaN reaches the shader whole.`,
  sections: [
    {
      heading: 'Declarations',
      rows: (row) => row.id === 'uniform',
      what: "`uniform type name;` declares a uniform of any value type, with an array size before the name, after it or both, and an optional `= constant` default, which Godot converts to the uniform's type. A precision word is allowed, but not on a bool. Godot refuses an interpolation qualifier, a struct, `void`, a default on an array, a name another uniform, function or built-in has, an assignment to a uniform and a uniform passed as an `out` argument. `global uniform` and `instance uniform` parse, and the transpiler refuses them at their row until they are bound.",
      tsl: 'a `uniform` node of the type, or a `uniformArray` of `uvec4`',
      probes: uniformProbes(/^(default|unset|precision|material|array|computed|in-|as-|refused)/),
    },
    {
      heading: '`group_uniforms`',
      rows: (row) => row.id === 'group_uniforms',
      what: '`group_uniforms name;` or `group_uniforms name.sub;` puts the uniforms after it in a group of the inspector, and `group_uniforms;` closes it. A group changes no value.',
      tsl: 'none: a group is for the inspector',
      probes: uniformProbes(/^group-/),
    },
    {
      heading: 'Colour hints',
      rows: (row) => /^(source_color|color_conversion_disabled)$/.test(row.id),
      what: '`source_color` marks a `vec3` or `vec4` as an sRGB colour, which goes to linear where the material converts colours: its default, and a Color the material sets. `color_conversion_disabled` after it keeps the colour as it is. A Color the material sets on a `vec3` or `vec4` with no hint converts too, as Godot does.',
      tsl: 'the converted value in the uniform',
      probes: uniformProbes(/^color-/),
    },
    {
      heading: 'Editor hints',
      rows: (row) => /^(hint_range|hint_enum)$/.test(row.id),
      what: '`hint_range(min, max, step)` and `hint_enum("a", "b")` tell the inspector how to edit an int or a float. Godot does not clamp the value to the range. A range gets a step of 1 on an int and 0.001 on a float when the text gives none.',
      tsl: 'none: the hint is for the inspector',
      probes: uniformProbes(/^hint-/),
    },
  ],
};

const textureProbes = (pattern) => (probe) =>
  probe.name.startsWith('texture-') && pattern.test(probe.name.slice(8));

const TEXTURES_CHAPTER = {
  file: 'textures.md',
  title: 'Textures',
  intro: `A sampler uniform reads a texture the material gives it. \`set\` takes a three.js \`Texture\` where Godot's \`set_shader_parameter\` takes a \`Texture2D\`, \`Texture3D\`, \`Texture2DArray\` or \`Cubemap\`, a list of them for a sampler array, or null:

\`\`\`js
const shader = transpileShadingLanguage('uniform sampler2D albedo : filter_nearest;\\nvec4 probe(vec2 uv) { return texture(albedo, uv); }');
shader.parameters.get('albedo').set(texture);
\`\`\`

The transpiler picks each texture as Godot's \`update_textures\` does (\`material_storage.cpp:880\`). A sampler the material leaves unset, or sets to null or NIL, reads Godot's 4 by 4 default texture of its hint and type: \`set_shader_parameter\` erases a null value. A Variant reads white. An array element the material's list does not reach, or a null element, reads the element before it, or white for the first. A \`samplerExternalOES\` has no default: while it has no texture, Godot builds no uniform set and does not draw the material. Then \`isDrawable\` of its parameter is false, and the sky's material is not \`visible\`.

Godot keeps the filter and repeat on the sampler, and three keeps them on the texture. So each sampler reads its own copy of the material's texture, which shares the texture's image and holds the sampler's filter, repeat and origin. A copy updates before each render after its texture updates. The binding disposes a copy that no element reads any more, or whose texture is disposed. A copy reads the image with Godot's top-left origin. A \`source_color\` sampler reads the texture through its sRGB view where the material converts colours, as \`p_use_linear_color\` decides.`,
  sections: [
    {
      heading: 'Sampler types',
      rows: (row) => /^[iu]?sampler/.test(row.id),
      what: "A sampler reads a 2D texture, a 2D array, a 3D texture, a cube or a cube array, of floats, ints (`isampler`) or uints (`usampler`). WebGL 2 has no cube array, so a `samplerCubeArray` reads a three.js `DataArrayTexture` with six layers to a cube, in Godot's face order +x, -x, +y, -y, +z, -z. Its read follows Vulkan's cube sampling: a filter footprint past a face edge reads the next face, and at a cube corner the three other texels share the corner's weight. On WebGLRenderer, the node of a 2D array, a cube array or a 3D texture uploads every level of the texture, which three uploads at level 0 only. WebGPURenderer is untested (#1788). Godot refuses `SCREEN_TEXTURE`, `DEPTH_TEXTURE` and `NORMAL_ROUGHNESS_TEXTURE` with its own message. A sampler can be an argument of a function: the transpiler writes the function once for each set of textures its calls pass.",
      tsl: 'a `texture`, `texture3D` or cube texture node per element, and a composite of texel loads for a cube array',
      probes: textureProbes(/^(layers|volume|cube|unsigned|argument|array|removed)/),
    },
    {
      heading: 'Default textures',
      rows: (row) => /^hint_(default_|normal$|roughness_|anisotropy)/.test(row.id),
      what: 'A hint names the texture a sampler reads while the material sets none: `hint_default_black` reads opaque black, `hint_default_transparent` transparent black, `hint_normal` and `hint_roughness_normal` the flat normal (128, 128, 255), and `hint_anisotropy` (255, 128, 255). Every other sampler reads white. A cube and a 3D texture have black, transparent and white only. A cube array reads white under `hint_default_white`, transparent black under `hint_default_transparent`, and opaque black under every other hint. The roughness hints change nothing the shader reads.',
      tsl: "a 4 by 4 texture of Godot's texel",
      probes: textureProbes(/^unset-/),
    },
    {
      heading: 'Filter and repeat',
      rows: (row) => /^(filter_|repeat_)/.test(row.id),
      what: "A filter word and a repeat word set the sampler. A sampler without one takes its shader type's default: `filter_linear_mipmap` and `repeat_enable` for spatial, sky and particles, `filter_linear_mipmap` and `repeat_disable` for fog, and `filter_linear` and `repeat_disable` for canvas_item. A filter without `_mipmap` reads level 0 only, at any level `textureLod` asks for. An anisotropic filter sets an anisotropy of 4, from the project's `anisotropic_filtering_level`. Vulkan and WebGL leave the anisotropic filter to the driver, so its texels can differ from Godot's.",
      tsl: "the texture's filters, wrap and anisotropy",
      probes: textureProbes(/^2d-(filter|default|repeat|lod)/),
    },
    {
      heading: 'Texture functions',
      rows: (row) => /^(texture|texelFetch)\w*\(/.test(row.id),
      what: '`texture` samples at a coordinate, with an optional bias. `textureLod` samples a level, `textureGrad` samples with gradients and `texelFetch` reads one texel of a level. `textureSize` gives the size of a level, and `textureQueryLevels` the level count of the texture. `textureQueryLod` gives the level of detail from the derivatives of the coordinate in texels, as Vulkan defines it. `textureGather` reads one channel of the four texels around the coordinate. A cube gathers on the face the direction picks, and a texel past the edge of the face comes from the next face. A 2D array and a cube array keep the layer in the last lane of the coordinate. `textureSize` of a cube array gives `ivec3(width, height, cubes)`, as the GLSL of Godot does, though Godot declares an `ivec2`. A swizzle, a constructor that uses every argument, a component-wise operator or call, and a choice take it. A return, a declaration, or an operator with an `ivec2` is refused, as GLSL refuses it in Godot.',
      tsl: 'the `sample`, `bias`, `level`, `grad`, `load` and `gather` nodes and `textureSize` of a texture node, a uniform for the level count, and a composite for the level of detail and a cube gather',
      probes: textureProbes(/^(2d-texel|2d-size|2d-lod|2d-source|function-)/),
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
  FUNCTIONS_CHAPTER,
  BUILT_IN_FUNCTIONS_CHAPTER,
  FOLDING_CHAPTER,
  BIT_FUNCTIONS_CHAPTER,
  PREPROCESSOR_CHAPTER,
  UNIFORMS_CHAPTER,
  TEXTURES_CHAPTER,
  HEAD_CHAPTER,
  SKY_CHAPTER,
];
