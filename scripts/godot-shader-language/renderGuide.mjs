/**
 * The user guide of the transpiler: an index of the coverage of each family of the instruction
 * table, and one chapter per family the transpiler reads. The rows, the probe sources and the
 * values come from the table, the probes and Godot's record, so the guide is stale only when they
 * change, and `--check` names it then.
 */

import { godotShader } from '../../apps/textscene-three-godot-shaders/tests/e2e/showcases.mjs';
import { floatOfBits } from '../../apps/textscene-three-godot-shaders/tests/probes/inputs.mjs';
import { PROBE_TYPES, probeSignature } from '../godot-probes/probeShader.mjs';
import { owningIssue, transpiledIds } from './renderTable.mjs';
import { targetStates } from './targetStates.mjs';
import { TESTING_FILE } from './renderTestingGuide.mjs';

/** The most input rows a section shows of a probe, so a table stays short. */
const SAMPLE_ROWS = 8;

const floatOfHex = (text) => floatOfBits(Number.parseInt(text, 16));

/** A lane of each scalar kind from the hex text of its bits, as the record holds it. */
const LANE_OF_HEX = {
  float: floatOfHex,
  int: (text) => Number.parseInt(text, 16) | 0,
  uint: (text) => Number.parseInt(text, 16) >>> 0,
  bool: (text) => Number.parseInt(text, 16) !== 0,
};

/** A lane's text, as the shading language writes a literal of its kind. */
function laneText(value, scalar) {
  if (scalar === 'float') return floatText(value);
  return scalar === 'uint' ? `${value}u` : String(value);
}

/** The shortest decimal text that reads back as this 32-bit float. */
export function floatText(value) {
  if (Number.isNaN(value)) return 'NaN';
  if (!Number.isFinite(value)) return value < 0 ? '-inf' : 'inf';
  if (Object.is(value, -0)) return '-0.0';
  for (let digits = 1; digits <= 9; digits += 1) {
    const text = String(Number(value.toPrecision(digits)));
    if (Math.fround(Number(text)) === value) return /[.e]/.test(text) ? text : `${text}.0`;
  }
  return String(value);
}

/** The kind of a float for the choice of sample rows: the signed zeros, subnormal, normal, infinite, NaN. */
function kindOf(value) {
  if (typeof value === 'boolean') return String(value);
  if (Number.isNaN(value)) return 'nan';
  if (Object.is(value, -0)) return '-0';
  if (value === 0) return '0';
  if (!Number.isFinite(value)) return value < 0 ? '-inf' : 'inf';
  return Math.abs(value) < 2 ** -126 ? 'subnormal' : 'normal';
}

/** The lanes of row `row` of parameter `values`, flat in the record, of type `type`. */
function rowLanes(values, row, type) {
  const { lanes, scalar } = PROBE_TYPES[type];
  return values.slice(row * lanes, (row + 1) * lanes).map(LANE_OF_HEX[scalar]);
}

function vectorText(lanes, type) {
  const texts = lanes.map((lane) => laneText(lane, PROBE_TYPES[type].scalar));
  return texts.length === 1 ? texts[0] : `(${texts.join(', ')})`;
}

/** The kinds a row shows: each lane's kind at its place, for inputs and result. */
function rowKinds({ inputs, outputs }) {
  const lanes = [...inputs.flat(), ...outputs];
  return lanes.map((value, place) => `${place}:${kindOf(value)}`);
}

/**
 * The sample rows of a probe: first a row of normal values, then, row by row, the one that shows
 * the most kinds of value at a place no row before it shows.
 */
function sampleRows(entry, parameters, returns) {
  const all = entry.results.map((result, row) => ({
    inputs: entry.inputs.map((values, index) => rowLanes(values, row, parameters[index])),
    outputs: rowLanes(result, 0, returns),
  }));
  const normal = all.find((row) =>
    [...row.inputs.flat(), ...row.outputs].every((value) => kindOf(value) === 'normal')
  );
  const picked = normal ? [normal] : [];
  const seen = new Set(picked.flatMap(rowKinds));
  const kinds = new Map(all.map((row) => [row, rowKinds(row)]));
  while (picked.length < SAMPLE_ROWS) {
    const unseen = (row) => kinds.get(row).filter((kind) => !seen.has(kind)).length;
    const scored = all.map((row) => ({ row, score: unseen(row) }));
    const best = scored.reduce((top, entry) => (entry.score > top.score ? entry : top), scored[0]);
    if (best.score === 0) break;
    picked.push(best.row);
    kinds.get(best.row).forEach((kind) => seen.add(kind));
  }
  return picked.sort((left, right) => all.indexOf(left) - all.indexOf(right));
}

/** Godot's reason for a probe it does not compile, and that the transpiler refuses it too. */
function rejectionText({ stage, message, line }) {
  if (stage === 'Godot')
    return `Godot ends as it compiles this shader: ${message}. The transpiler refuses it with a message that says so.`;
  const where =
    stage === 'GLSL' ? "the GPU compiler refuses Godot's GLSL" : `Godot refuses it at line ${line}`;
  return `Godot does not compile this shader: ${where}, \`${message}\`. The transpiler refuses it too.`;
}

function probeValues(probe, entry) {
  if (entry.rejected) return rejectionText(entry.rejected);
  const { parameters, names, returns } = probeSignature(probe.source);
  if (entry.inputs.length === 0) {
    const literals =
      probe.source
        .match(/return \w+\((.*)\);/)?.[1]
        ?.split(',')
        .map((text) => text.trim()) ?? [];
    const scalar = PROBE_TYPES[returns].scalar;
    const lines = entry.results[0].map(
      (bits, lane) =>
        `| \`${literals[lane] ?? lane}\` | \`${laneText(LANE_OF_HEX[scalar](bits), scalar)}\` | \`${bits}\` |`
    );
    return ['| Literal | Godot draws | Bits |', '| --- | --- | --- |', ...lines].join('\n');
  }
  const lines = sampleRows(entry, parameters, returns).map(
    ({ inputs, outputs }) =>
      `| ${inputs.map((lanes, index) => `\`${vectorText(lanes, parameters[index])}\``).join(' | ')} | \`${vectorText(outputs, returns)}\` |`
  );
  const header = `| ${names.map((name) => `\`${name}\``).join(' | ')} | Godot gives |`;
  const rule = `| ${names.map(() => '---').join(' | ')} | --- |`;
  return [header, rule, ...lines].join('\n');
}

function renderProbe(probe, record) {
  const entry = record.probes[probe.name];
  if (!entry) throw new Error(`expected a record of Godot's answers for probe ${probe.name}, found none`);
  const rowCount = entry.results?.length ?? 0;
  const count =
    entry.inputs.length === 0 ? 'no input' : `${rowCount} input ${rowCount === 1 ? 'row' : 'rows'}`;
  return `### Probe \`${probe.name}\`, ${count}

\`\`\`glsl
${probe.source}
\`\`\`

${probeValues(probe, entry)}
`;
}

/**
 * The state of a section's rows on each target: one line when every row is native on both, and
 * each lowered row by name otherwise.
 */
function statesText(rows) {
  const lowered = rows
    .map((row) => ({ row, states: targetStates(row) }))
    .filter(({ states }) => states.webgl2 !== 'native' || states.webgpu !== 'native');
  const native = 'native on WebGL 2 and on WebGPURenderer';
  if (lowered.length === 0) return `Every row is ${native}.`;
  const lines = lowered.map(
    ({ row, states }) => `- \`${row.id}\`: WebGL 2 ${states.webgl2}, WebGPURenderer ${states.webgpu}.`
  );
  const rest = lowered.length === rows.length ? '' : ` The other rows are ${native}.`;
  return `Lowered rows:\n\n${lines.join('\n')}\n\n${rest.trim()}`.trim();
}

function renderSection(section, rows, probes, record) {
  const ids = new Set(rows.map((row) => row.id));
  const sectionProbes = probes.filter((probe) => probe.rows.some((id) => ids.has(id)));
  const rowList = rows.map((row) => `\`${row.id}\``).join(', ');
  return `## ${section.heading}

${section.what}

The transpiler emits \`${section.tsl}\`. Rows: ${rowList}. Godot source: \`${rows[0].source}\`.

${statesText(rows)}

${sectionProbes.map((probe) => renderProbe(probe, record)).join('\n')}`;
}

/**
 * A chapter's sections, each with its transpiled rows. Throws for a transpiled row no section
 * holds, and for a section that holds no transpiled row.
 */
function chapterSections(chapters, rows, probes) {
  const transpiled = transpiledIds(probes);
  const transpiledRows = rows.filter((row) => transpiled.has(row.id));
  const placed = chapters.map((chapter) => ({
    chapter,
    sections: chapter.sections.map((section) => ({ section, rows: transpiledRows.filter(section.rows) })),
  }));
  const covered = new Set(
    placed.flatMap(({ sections }) => sections.flatMap(({ rows: held }) => held.map((row) => row.id)))
  );
  const missing = transpiledRows.filter((row) => !covered.has(row.id)).map((row) => row.id);
  if (missing.length > 0) {
    throw new Error(
      `expected a guide section in guideChapters.mjs for each transpiled row, found none for ${missing.join(', ')}`
    );
  }
  // A section cites the Godot source of its first row, so a section with no row has nothing to cite.
  const empty = placed.flatMap(({ sections }) => sections.filter(({ rows: held }) => held.length === 0));
  if (empty.length > 0) {
    throw new Error(
      `expected a transpiled row in each guide section, found none in ${empty.map(({ section }) => section.heading).join(', ')}`
    );
  }
  return placed;
}

/** The width the guide shows a showcase image at: four screen pixels to each image pixel. */
const SHOWCASE_SCALE = 4;

function renderShowcase(showcase) {
  const image = (side, label) =>
    `<img src="showcase/${showcase.name}-${side}.png" width="${showcase.width * SHOWCASE_SCALE}" alt="${label}">`;
  return `## Showcase \`${showcase.name}\`

Godot draws this shader. A plain three.js page draws the transpilation of its function \`pattern\` with the same UV. \`pnpm test:shaders:e2e\` draws both again and fails on any pixel over 2/255 apart.

\`\`\`glsl
${godotShader(showcase).trim()}
\`\`\`

| Godot | Transpilation on three.js |
| --- | --- |
| ${image('godot', 'Godot')} | ${image('three', 'Transpilation')} |
`;
}

function renderChapter({ chapter, sections }, probes, record, showcases) {
  const chapterShowcases = showcases.filter((showcase) => showcase.chapter === chapter.file);
  return `# ${chapter.title}

${chapter.intro}

Godot ${record.godot}, probed on ${record.adapter}. Each table shows at most ${SAMPLE_ROWS} of a probe's rows, picked to show as many mixes of zero, subnormal, normal, infinite and NaN values as fit. The real-GL test (\`pnpm test:shaders:gpu\`) checks every row, bit for bit, NaN lanes compared as NaN. Generated by \`pnpm godot:shader-language\`: do not edit by hand.

${chapterShowcases.map(renderShowcase).join('\n')}
${sections.map(({ section, rows }) => renderSection(section, rows, probes, record)).join('\n')}`;
}

/** Each row is one typed form, so a name repeats: the sentence that says how the count adds up. */
function rowCountNote(rows) {
  const formsOf = (test) => {
    const formRows = rows.filter((row) => test(row.family));
    const names = new Set(formRows.map((row) => row.id.replace(/\(.*$/, '')));
    return { forms: formRows.length, names: names.size };
  };
  const operators = formsOf((family) => family === 'operator');
  const functions = formsOf((family) => family.startsWith('function'));
  const constructors = formsOf((family) => family === 'constructor');
  const builtIns = formsOf((family) => family.startsWith('built-in'));
  return (
    `A row is one typed form of an instruction, so a name has many rows: ` +
    `${operators.forms} operator signatures of ${operators.names} operators, ` +
    `${functions.forms} overloads of ${functions.names} built-in functions, ` +
    `${constructors.forms} constructor overloads of ${constructors.names} types, and ` +
    `${builtIns.forms} built-ins, one per shader type and stage that has it.`
  );
}

/** The two drivers that a bit-equal probe compares. */
function driversNote(record) {
  return (
    `Godot draws the probes and showcases on Vulkan over lavapipe (\`${record.adapter}\`). ` +
    `The transpilation draws in headless Chromium, WebGL 2 through ANGLE on Vulkan over the same lavapipe, ` +
    `and the run stops when the browser reports another renderer. "Bit-equal" is a claim about that pair.`
  );
}

function renderIndex(placed, rows, probes, record, version) {
  const transpiled = transpiledIds(probes);
  const families = [...new Set(rows.map((row) => row.family))];
  const familyLines = families.map((family) => {
    const familyRows = rows.filter((row) => row.family === family);
    const done = familyRows.filter((row) => transpiled.has(row.id)).length;
    const owners = [...new Set(familyRows.filter((row) => !transpiled.has(row.id)).map(owningIssue))];
    return `| ${family} | ${done} of ${familyRows.length} | ${owners.join(', ') || 'none'} |`;
  });
  const chapterLines = placed.map(
    ({ chapter, sections }) =>
      `- [${chapter.title}](${chapter.file}): ${sections.map(({ section }) => section.heading).join(', ')}.`
  );
  return `# The shading language transpiler

\`@textscene/three-godot-shaders\` transpiles Godot ${version}'s shading language to three.js TSL nodes, instruction by instruction. This guide explains each instruction the transpiler reads, with the values Godot gave for it. A text that uses an instruction not transpiled yet fails with an error that names the instruction and the issue that transpiles it.

One Godot version: the previewer draws every project as Godot ${version} draws it. The transpiler reads every shader with the rules of Godot ${version}, not of the version a project's \`project.godot\` names.

${transpiled.size} of ${rows.length} instructions transpiled. [INSTRUCTIONS.md](../INSTRUCTIONS.md) lists every row with its state. Generated by \`pnpm godot:shader-language\`: do not edit by hand.

${rowCountNote(rows)}

${driversNote(record)}

## Chapters

${chapterLines.join('\n')}
- [How the tests check the transpiler against Godot](${TESTING_FILE}): every operator rule, random programs and a corpus of real shaders.

## Coverage by family

| Family | Transpiled | Open rows owned by |
| --- | --- | --- |
${familyLines.join('\n')}
`;
}

/** The guide's files: `[name, text]` for the index and each chapter. */
export function renderGuide({ chapters, rows, probes, record, version, showcases = [] }) {
  const placed = chapterSections(chapters, rows, probes);
  return [
    ['README.md', renderIndex(placed, rows, probes, record, version)],
    ...placed.map((entry) => [entry.chapter.file, renderChapter(entry, probes, record, showcases)]),
  ];
}
