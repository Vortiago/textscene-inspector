/**
 * The two files the instruction table writes: the TypeScript rows the translator reads, and the
 * readable table that names each row's state and, for an open row, the issue that owns it.
 */

/** The fields of a row, in the order each line of the module holds them, tab-separated. */
const ROW_FIELDS = ['id', 'family', 'source', 'owner', 'token', 'returns', 'args'];

/**
 * The generated module: one row per line, so a diff names the rows that changed. The rows are
 * text that the module splits once: an array literal of every row, near 1,900 objects, is past
 * what TypeScript types (TS2590).
 */
export function renderTableModule(rows) {
  const lines = rows.map((row) =>
    ROW_FIELDS.map((field) => fieldText(field === 'owner' ? owningIssue(row) : row[field])).join('\t')
  );
  return `/**
 * The instruction table of Godot 4.6.3's shading language, read from Godot's source.
 * AUTO-GENERATED - Do not edit manually. Run: pnpm godot:shader-language
 */

/** One instruction: a type, a keyword, an operator signature, a function overload or a built-in. */
export interface InstructionRow {
  readonly id: string;
  readonly family: string;
  /** Godot's \`file:line\` that defines it. */
  readonly source: string;
  /** The issue that translates it, which an error for an open row names. */
  readonly owner: string;
  /** Godot's token for a keyword. */
  readonly token?: string;
  readonly returns?: string;
  readonly args?: readonly string[];
}

/**
 * One row per line: ${ROW_FIELDS.join(', ')}, tab-separated. An empty field is absent, and the
 * args are a bracketed list, so a function of no arguments has \`()\`.
 */
const ROWS = \`
${lines.join('\n')}
\`;

function readRow(line: string): InstructionRow {
  const [id = '', family = '', source = '', owner = '', token, returns, args] = line.split('\\t');
  return {
    id,
    family,
    source,
    owner,
    ...(token ? { token } : {}),
    ...(returns ? { returns } : {}),
    ...(args ? { args: args === '()' ? [] : args.slice(1, -1).split(',') } : {}),
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
 * The issue that owns an open row: the slice of the translator's plan that translates
 * its family. A row this cannot place throws, so no open row is left without an owner.
 */
export function owningIssue(row) {
  switch (row.family) {
    case 'data type':
    case 'literal':
    case 'swizzle':
    case 'constructor':
      return '#1823';
    case 'operator':
      return operatorOwner(row);
    case 'statement':
    case 'statement keyword':
      return '#1824';
    case 'tree node':
      return treeNodeOwner(row);
    case 'qualifier':
      return /^(in|out|inout)$/.test(row.id) ? '#1825' : '#1794';
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

/** The shader and function nodes are the head's, structs and members the types', the rest the statements'. */
/**
 * `OP_CALL` is a call of a function: of a built-in, whose overload row owns it, or of the shader's
 * own function, whose parameters and their `in`, `out` and `inout` qualifiers its slice translates.
 */
function operatorOwner(row) {
  if (row.id === 'OP_CALL') return '#1825';
  return /^OP_(SELECT_ELSE|CONSTRUCT|STRUCT|INDEX|EMPTY)$/.test(row.id) ? '#1824' : '#1823';
}

function treeNodeOwner(row) {
  if (/^NODE_TYPE_(SHADER|FUNCTION)$/.test(row.id)) return '#1794';
  if (/^NODE_TYPE_(VARIABLE|CONSTANT|OPERATOR|MEMBER|STRUCT)$/.test(row.id)) return '#1823';
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
 * The readable table: the count of translated rows, then one table per family with each row's
 * state. A row is translated when a probe names it, and the probe's name stands beside it.
 */
export function renderReadableTable(rows, probes) {
  const probeOf = new Map();
  for (const probe of probes)
    for (const id of probe.rows) probeOf.set(id, [...(probeOf.get(id) ?? []), probe.name]);
  const translatedCount = rows.filter(({ id }) => probeOf.has(id)).length;
  const families = [...new Set(rows.map(({ family }) => family))];
  const sections = families.map((family) => {
    const familyRows = rows.filter((row) => row.family === family);
    const lines = familyRows.map((row) => {
      const names = probeOf.get(row.id);
      const state = names
        ? `translated (${names.map((name) => `\`${name}\``).join(', ')})`
        : `open, ${owningIssue(row)}`;
      return `| \`${row.id}\` | ${state} | \`${row.source}\` |`;
    });
    return `## ${family}\n\n| Instruction | State | Godot source |\n| --- | --- | --- |\n${lines.join('\n')}\n`;
  });
  return `# Instruction table

The shader package translates Godot 4.6.3's shading language instruction by instruction. This
table lists every instruction, read from Godot's source by \`pnpm godot:shader-language\`. Do
not edit it by hand.

A row is translated when a probe names it. The probe's record holds Godot's own answers, and the
real-GL test checks the translation against them. An open row names the issue that translates it.

${translatedCount} of ${rows.length} instructions translated.

${sections.join('\n')}`;
}
