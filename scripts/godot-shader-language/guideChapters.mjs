/**
 * The prose of the user guide of the transpiler: one chapter per family of instructions it
 * transpiles, one section per instruction. `renderGuide.mjs` adds what no one types by hand: the
 * rows, the probes and Godot's recorded values. A transpiled row with no section fails the build.
 */

const ARITHMETIC = [
  ['OP_ADD', '+', 'add', 'adds'],
  ['OP_SUB', '-', 'sub', 'subtracts'],
  ['OP_MUL', '*', 'mul', 'multiplies'],
  ['OP_DIV', '/', 'div', 'divides'],
];

function arithmeticSection([op, token, method, verb]) {
  return {
    heading: `\`${token}\` (${op})`,
    rows: (row) => row.id.startsWith(`${op}(`),
    what: `\`a ${token} b\` ${verb} lane by lane. Two vectors must have the same size. A float on either side applies to every lane of the vector on the other side, and the result has the vector's type.`,
    tsl: `a.${method}(b)`,
  };
}

export const GUIDE_CHAPTERS = [
  {
    file: 'float-arithmetic.md',
    title: 'Float and vector arithmetic',
    intro: `The float types \`float\`, \`vec2\`, \`vec3\` and \`vec4\`: their literals, the four arithmetic operators, negation, the vector constructors and swizzles. A function of this chapter's instructions transpiles to TSL nodes that compute what Godot computes, bit for bit, on the GPU that ran the probes.

The GPU sets the edge cases, not the transpiler. On the probe GPU, an arithmetic operator reads a subnormal input as zero, negation keeps it, and \`0.0 / 0.0\` is NaN. The tables below show each case as Godot gave it.`,
    sections: [
      {
        heading: 'Float literals',
        rows: (row) => row.id === 'float literal',
        what: `A literal such as \`2.5\`, \`.5\`, \`1e-3\` or \`2.5f\`. Godot reads the text with its own decimal reader, keeps a 32-bit float, and writes the float back into the GLSL it compiles with 14 decimals (\`shader_compiler.cpp:180\`). So a value under \`1e-14\` draws as \`0.0\`, a value with more digits draws with fewer, and a literal past the float range, such as \`1e39\`, fails to compile. The transpiler gives each literal the float that this chain gives.`,
        tsl: 'float(value)',
      },
      ...ARITHMETIC.map(arithmeticSection),
      {
        heading: 'Negation `-a` (OP_NEGATE)',
        rows: (row) => row.id.startsWith('OP_NEGATE('),
        what: '`-a` flips the sign of each lane, `0.0` and NaN included.',
        tsl: 'a.negate()',
      },
      {
        heading: 'Vector constructors',
        rows: (row) => row.family === 'constructor',
        what: '`vec3(a, b)` fills the lanes of the new vector with the lanes of its arguments, in order. One float argument fills every lane. The argument lanes must add up to the vector size.',
        tsl: 'vec3(a, b)',
      },
      {
        heading: 'Swizzles',
        rows: (row) => row.family === 'swizzle',
        what: '`a.zyx` reads the named lanes, in any order, repeated or not, up to four. The letters come from one set: `xyzw`, `rgba` or `stpq`. Godot refuses a mix such as `a.xg`, and a letter past the vector, such as `.z` on a `vec2`.',
        tsl: 'a.zyx',
      },
    ],
  },
];
