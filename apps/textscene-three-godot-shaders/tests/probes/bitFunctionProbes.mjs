import { INSTRUCTION_TABLE } from '../../../../packages/textscene-core/src/shaders/language/instructionTable.generated.ts';
import { nameOf, probeName, probeOf, valueProbe } from './builtInFunctionProbes.mjs';
import { probeOf as sourceProbe } from './languageProbes.mjs';

const OWNER = '#1827';

const zeroOf = (type) => `${type}(${/^u|^uvec/.test(type) ? '0u' : '0'})`;

function carryProbes(row) {
  const [type] = row.args;
  const call = `${nameOf(row)}(a, b, written)`;
  const local = `${type} written = ${zeroOf(type)};`;
  return [
    probeOf(`${probeName(row.id)}-result`, [row.id], type, [type, type], `${local} return ${call};`),
    probeOf(
      `${probeName(row.id)}-written`,
      [row.id],
      type,
      [type, type],
      `${local} ${call}; return written;`
    ),
  ];
}

function extendedProbes(row) {
  const [type] = row.args;
  const locals = `${type} msb = ${zeroOf(type)}; ${type} lsb = ${zeroOf(type)}; ${nameOf(row)}(a, b, msb, lsb);`;
  return ['msb', 'lsb'].map((half) =>
    probeOf(`${probeName(row.id)}-${half}`, [row.id], type, [type, type], `${locals} return ${half};`)
  );
}

function frexpProbes(row) {
  const [type, exponentType] = row.args;
  const local = `${exponentType} exponent = ${zeroOf(exponentType)};`;
  return [
    probeOf(`${probeName(row.id)}-fraction`, [row.id], type, [type], `${local} return frexp(a, exponent);`),
    probeOf(
      `${probeName(row.id)}-exponent`,
      [row.id],
      exponentType,
      [type],
      `${local} frexp(a, exponent); return exponent;`
    ),
  ];
}

// GLSL leaves an exponent past 128 undefined and lets one below -126 flush.
function ldexpProbe(row) {
  const [type, exponentType] = row.args;
  return probeOf(
    probeName(row.id),
    [row.id],
    type,
    [type, exponentType],
    `${exponentType} exponent = clamp(b, -126, 128); return ldexp(a, exponent);`
  );
}

// GLSL leaves a field past bit 31 undefined. Each edge field ends at bit 32.
const FIELD = ['b & 15', 'c & 15'];
const EDGE_FIELDS = [
  ['whole-word', '0, 32'],
  ['top-bit', '31, 1'],
  ['empty-at-the-top', '32, 0'],
];

function bitfieldExtractProbes(row) {
  const probe = (name, field) =>
    probeOf(name, [row.id], row.returns, row.args, `return bitfieldExtract(a, ${field});`);
  return [
    probe(probeName(row.id), FIELD.join(', ')),
    ...EDGE_FIELDS.map(([word, field]) => probe(`${probeName(row.id)}-${word}`, field)),
  ];
}

function bitfieldInsertProbes(row) {
  const probe = (name, field) =>
    probeOf(name, [row.id], row.returns, row.args, `return bitfieldInsert(a, b, ${field});`);
  return [
    probe(probeName(row.id), ['c & 15', 'd & 15'].join(', ')),
    ...EDGE_FIELDS.map(([word, field]) => probe(`${probeName(row.id)}-${word}`, field)),
  ];
}

const PROBES_OF = {
  uaddCarry: carryProbes,
  usubBorrow: carryProbes,
  umulExtended: extendedProbes,
  imulExtended: extendedProbes,
  frexp: frexpProbes,
  ldexp: (row) => [ldexpProbe(row)],
  bitfieldExtract: bitfieldExtractProbes,
  bitfieldInsert: bitfieldInsertProbes,
};

function refusalProbes() {
  const cases = [
    [
      'ldexp-of-a-constant-exponent',
      ['ldexp(float,int)'],
      'float probe(float a) {\n\treturn ldexp(a, 2);\n}',
    ],
    ['frexp-to-a-value', ['frexp(float,int)'], 'float probe(float a) {\n\treturn frexp(a, 1 + 1);\n}'],
  ];
  return cases.map(([word, rows, source]) => sourceProbe(`call-${word}`, rows, source));
}

// Negative constants: three writes a negative uint constant as `0u`.
function constantProbes() {
  const cases = [
    ['bitCount', 'bitCount(int)', 'bitCount(-42)'],
    ['findLSB', 'findLSB(int)', 'findLSB(-8)'],
    ['findMSB', 'findMSB(int)', 'findMSB(-42)'],
    ['bitfieldReverse', 'bitfieldReverse(int)', 'bitfieldReverse(-42)'],
    ['bitfieldExtract', 'bitfieldExtract(int,int,int)', 'bitfieldExtract(-42, 3, 5)'],
    ['bitfieldInsert', 'bitfieldInsert(int,int,int,int)', 'bitfieldInsert(-42, -1, 4, 8)'],
  ];
  return cases.map(([word, row, call]) =>
    probeOf(`call-${word}-of-a-negative-constant`, [row], 'int', ['int'], `return ${call} + a;`)
  );
}

const isOwned = (row) => row.family.startsWith('function') && row.owner === OWNER;

export const BIT_FUNCTION_PROBES = [
  ...INSTRUCTION_TABLE.filter(isOwned).flatMap((row) => PROBES_OF[nameOf(row)]?.(row) ?? [valueProbe(row)]),
  ...refusalProbes(),
  ...constantProbes(),
];
