/**
 * The two files the instruction table writes: the TypeScript rows the transpiler reads, and the
 * readable table that names each row's state and, for an open row, the issue that owns it.
 */

import { TARGETS, targetStates } from './targetStates.mjs';

/** The fields of a row, in the order each line of the module holds them, tab-separated. */
const ROW_FIELDS = ['id', 'family', 'source', 'owner', 'token', 'returns', 'args', ...TARGETS];

/** The ids of the rows a probe names: the transpiled rows. */
export const transpiledIds = (probes) => new Set(probes.flatMap((probe) => probe.rows));

/**
 * The generated module: one row per line, so a diff names the rows that changed. The rows are
 * text that the module splits once: an array literal of every row, near 1,900 objects, is past
 * what TypeScript types (TS2590).
 */
export function renderTableModule(rows, probes, version) {
  const transpiled = transpiledIds(probes);
  const lines = rows.map((row) => {
    const fields = { ...row, owner: owningIssue(row), ...(transpiled.has(row.id) ? targetStates(row) : {}) };
    return ROW_FIELDS.map((field) => fieldText(fields[field])).join('\t');
  });
  return `/**
 * The instruction table of Godot ${version}'s shading language, read from Godot's source.
 * AUTO-GENERATED - Do not edit manually. Run: pnpm godot:shader-language
 */

/** The Godot version whose source the table is read from, and whose rules the transpiler follows. */
export const GODOT_VERSION = '${version}';

/** A transpiled row's state on a target: \`native\`, or \`lowered: \` and the name of the lowering. */
export type TargetState = string;

/** One instruction: a type, a keyword, an operator signature, a function overload or a built-in. */
export interface InstructionRow {
  readonly id: string;
  readonly family: string;
  /** Godot's \`file:line\` that defines it. */
  readonly source: string;
  /** The issue that transpiles it, which an error for an open row names. */
  readonly owner: string;
  /** Godot's token for a keyword. */
  readonly token?: string;
  readonly returns?: string;
  readonly args?: readonly string[];
  /** The state on WebGL 2 through three's handler. Only a transpiled row has one. */
  readonly webgl2?: TargetState;
  /** The state on WebGPURenderer. Only a transpiled row has one. */
  readonly webgpu?: TargetState;
}

/**
 * One row per line: ${ROW_FIELDS.join(', ')}, tab-separated. An empty field is absent, and the
 * args are a bracketed list, so a function of no arguments has \`()\`.
 */
const ROWS = \`
${lines.join('\n')}
\`;

function readRow(line: string): InstructionRow {
  const [id = '', family = '', source = '', owner = '', token, returns, args, webgl2, webgpu] =
    line.split('\\t');
  return {
    id,
    family,
    source,
    owner,
    ...(token ? { token } : {}),
    ...(returns ? { returns } : {}),
    ...(args ? { args: args === '()' ? [] : args.slice(1, -1).split(',') } : {}),
    ...(webgl2 ? { webgl2 } : {}),
    ...(webgpu ? { webgpu } : {}),
  };
}

export const INSTRUCTION_TABLE: readonly InstructionRow[] = ROWS.trim().split('\\n').map(readRow);
`;
}

function fieldText(value) {
  if (value === undefined) return '';
  return Array.isArray(value) ? `(${value.join(',')})` : value;
}

/**
 * The issue that owns an open row: the slice of the transpiler's plan that transpiles
 * its family. A row this cannot place throws, so no open row is left without an owner.
 */
export function owningIssue(row) {
  switch (row.family) {
    case 'data type':
      return dataTypeOwner(row);
    case 'literal':
    case 'swizzle':
    case 'constructor':
      return '#1823';
    case 'operator':
      return operatorOwner(row);
    case 'statement':
    case 'statement keyword':
      return /^(return|FLOW_OP_RETURN)$/.test(row.id) ? '#1823' : '#1824';
    case 'tree node':
      return treeNodeOwner(row);
    case 'qualifier':
      return qualifierOwner(row);
    case 'function':
    case 'function (high_end)':
      return functionOwner(row);
    case 'uniform':
    case 'uniform hint':
    case 'sampler setting':
      return '#1829';
    case 'shader head':
      return /^(uniform|group_uniforms)$/.test(row.id) ? '#1829' : '#1794';
    case 'built-in':
    case 'built-in (read only)':
    case 'stage function':
    case 'render mode':
    case 'stencil mode':
      return '#1794';
    case 'preprocessor':
      return '#1828';
    default:
      throw new Error(`expected a family with an owning issue, got ${row.family}`);
  }
}

/** Samplers are the uniforms slice's, a struct type and `void` the statements', the value types this slice's. */
function dataTypeOwner(row) {
  if (/^[iu]?sampler|^samplerExternalOES$/.test(row.id)) return '#1829';
  if (/^(struct type|void)$/.test(row.id)) return '#1824';
  return '#1823';
}

/** `in`, `out` and `inout` are the functions slice's, the precision qualifiers this slice's, the rest the head's. */
function qualifierOwner(row) {
  if (/^(in|out|inout)$/.test(row.id)) return '#1825';
  if (/^(lowp|mediump|highp)$/.test(row.id)) return '#1823';
  return '#1794';
}

/**
 * `OP_CALL` is a call of a function: of a built-in, whose overload row owns it, or of the shader's
 * own function, whose parameters and their `in`, `out` and `inout` qualifiers its slice transpiles.
 * `OP_STRUCT` builds a struct, which the statements slice declares. Each other operator is this slice's.
 */
function operatorOwner(row) {
  if (row.id === 'OP_CALL') return '#1825';
  return row.id === 'OP_STRUCT' ? '#1824' : '#1823';
}

/** The shader and function nodes are the head's, the nodes of expressions this slice's, the rest the statements'. */
function treeNodeOwner(row) {
  if (/^NODE_TYPE_(SHADER|FUNCTION)$/.test(row.id)) return '#1794';
  if (/^NODE_TYPE_(VARIABLE|CONSTANT|OPERATOR|MEMBER)$/.test(row.id)) return '#1823';
  return '#1824';
}

/** Texture functions belong to the uniforms slice, integer, bit, pack and derivative ones to their own, the rest to the functions slice. */
function functionOwner(row) {
  const name = row.id.slice(0, row.id.indexOf('('));
  if (/^(int|float|uint|bool)$/.test(name)) return '#1823';
  if (name === 'length[array]') return '#1824';
  if (/^texture|^texelFetch/.test(name)) return '#1829';
  if (row.family === 'function (high_end)') return '#1827';
  if (/^(dFd[xy]|fwidth)$|BitsTo|^(pack|unpack)/.test(name)) return '#1827';
  return '#1826';
}

/**
 * The readable table: the count of transpiled rows, then one table per family with each row's
 * state. A row is transpiled when a probe names it, and the probe's name stands beside it, with
 * the row's state on each target.
 */
export function renderReadableTable(rows, probes, version) {
  const probeOf = new Map();
  for (const probe of probes)
    for (const id of probe.rows) probeOf.set(id, [...(probeOf.get(id) ?? []), probe.name]);
  const transpiledCount = rows.filter(({ id }) => probeOf.has(id)).length;
  const families = [...new Set(rows.map(({ family }) => family))];
  const sections = families.map((family) => {
    const familyRows = rows.filter((row) => row.family === family);
    const lines = familyRows.map((row) => {
      const names = probeOf.get(row.id);
      if (!names) return `| \`${row.id}\` | open, ${owningIssue(row)} | | | \`${row.source}\` |`;
      const probeList = names.map((name) => `\`${name}\``).join(', ');
      const states = targetStates(row);
      return `| \`${row.id}\` | transpiled (${probeList}) | ${states.webgl2} | ${states.webgpu} | \`${row.source}\` |`;
    });
    return `## ${family}\n\n| Instruction | State | WebGL 2 | WebGPU | Godot source |\n| --- | --- | --- | --- | --- |\n${lines.join('\n')}\n`;
  });
  return `# Instruction table

The shader package transpiles Godot ${version}'s shading language instruction by instruction. This
table lists every instruction, read from Godot's source by \`pnpm godot:shader-language\`. Do
not edit it by hand.

A row is transpiled when a probe names it. The probe's record holds Godot's own answers, and the
real-GL test checks the transpilation against them. An open row names the issue that transpiles it.

A transpiled row states what the emitter writes for each target: \`native\` when its TSL node is the
GLSL or WGSL operation itself, \`lowered\` with the name of the operations it writes instead. The
probes run on WebGL 2. WebGPURenderer runs the same TSL nodes, and no probe runs there until the
canvases draw on WebGPURenderer (#1788).

${transpiledCount} of ${rows.length} instructions transpiled.

${sections.join('\n')}`;
}
