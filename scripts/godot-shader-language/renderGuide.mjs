/**
 * The user guide of the translator: an index of the coverage of each family of the instruction
 * table, and one chapter per family the translator reads. The rows, the probe sources and the
 * values come from the table, the probes and Godot's record, so the guide is stale only when they
 * change, and `--check` names it then.
 */

import { godotShader } from '../../apps/textscene-three-godot-shaders/tests/e2e/showcases.mjs';
import { floatOfBits } from '../../apps/textscene-three-godot-shaders/tests/probes/inputs.mjs';
import { LANE_COUNT, probeSignature } from '../godot-probes/probeShader.mjs';
import { owningIssue } from './renderTable.mjs';

/** The most input rows a section shows of a probe, so a table stays short. */
const SAMPLE_ROWS = 8;

const floatOfHex = (text) => floatOfBits(Number.parseInt(text, 16));

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
  if (Number.isNaN(value)) return 'nan';
  if (Object.is(value, -0)) return '-0';
  if (value === 0) return '0';
  if (!Number.isFinite(value)) return value < 0 ? '-inf' : 'inf';
  return Math.abs(value) < 2 ** -126 ? 'subnormal' : 'normal';
}

/** The lanes of row `row` of parameter `values`, flat in the record, `size` lanes a row. */
function rowLanes(values, row, size) {
  return values.slice(row * size, (row + 1) * size).map(floatOfHex);
}

const vectorText = (lanes) =>
  lanes.length === 1 ? floatText(lanes[0]) : `(${lanes.map(floatText).join(', ')})`;

/** The kinds a row shows: each lane's kind at its place, for inputs and result. */
function rowKinds({ inputs, outputs }) {
  const lanes = [...inputs.flat(), ...outputs];
  return lanes.map((value, place) => `${place}:${kindOf(value)}`);
}

/**
 * The sample rows of a probe: first a row of normal values, then, row by row, the one that shows
 * the most kinds of value at a place no row before it shows.
 */
function sampleRows(entry, sizes) {
  const all = entry.results.map((result, row) => ({
    inputs: entry.inputs.map((values, index) => rowLanes(values, row, sizes[index])),
    outputs: result.map(floatOfHex),
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

function probeValues(probe, entry) {
  if (entry.rejected)
    return 'Godot does not compile this shader: it draws nothing. The translator refuses it too.';
  if (entry.inputs.length === 0) {
    const literals =
      probe.source
        .match(/vec4\((.*)\);/)?.[1]
        ?.split(',')
        .map((text) => text.trim()) ?? [];
    const lines = entry.results[0].map(
      (bits, lane) => `| \`${literals[lane] ?? lane}\` | \`${floatText(floatOfHex(bits))}\` | \`${bits}\` |`
    );
    return ['| Literal | Godot draws | Bits |', '| --- | --- | --- |', ...lines].join('\n');
  }
  const { parameters, names } = probeSignature(probe.source);
  const sizes = parameters.map((type) => LANE_COUNT[type]);
  const lines = sampleRows(entry, sizes).map(
    ({ inputs, outputs }) =>
      `| ${inputs.map((lanes) => `\`${vectorText(lanes)}\``).join(' | ')} | \`${vectorText(outputs)}\` |`
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

function renderSection(section, rows, probes, record) {
  const ids = new Set(rows.map((row) => row.id));
  const sectionProbes = probes.filter((probe) => probe.rows.some((id) => ids.has(id)));
  const rowList = rows.map((row) => `\`${row.id}\``).join(', ');
  return `## ${section.heading}

${section.what}

The translator emits \`${section.tsl}\`. Rows: ${rowList}. Godot source: \`${rows[0].source}\`.

${sectionProbes.map((probe) => renderProbe(probe, record)).join('\n')}`;
}

/** The rows a probe names, which are the translated rows. */
const translatedIds = (probes) => new Set(probes.flatMap((probe) => probe.rows));

/**
 * A chapter's sections, each with its translated rows. Throws for a translated row no section
 * holds, and for a section that holds no translated row.
 */
function chapterSections(chapters, rows, probes) {
  const translated = translatedIds(probes);
  const translatedRows = rows.filter((row) => translated.has(row.id));
  const placed = chapters.map((chapter) => ({
    chapter,
    sections: chapter.sections.map((section) => ({ section, rows: translatedRows.filter(section.rows) })),
  }));
  const covered = new Set(
    placed.flatMap(({ sections }) => sections.flatMap(({ rows: held }) => held.map((row) => row.id)))
  );
  const missing = translatedRows.filter((row) => !covered.has(row.id)).map((row) => row.id);
  if (missing.length > 0) {
    throw new Error(
      `expected a guide section in guideChapters.mjs for each translated row, found none for ${missing.join(', ')}`
    );
  }
  // A section cites the Godot source of its first row, so a section with no row has nothing to cite.
  const empty = placed.flatMap(({ sections }) => sections.filter(({ rows: held }) => held.length === 0));
  if (empty.length > 0) {
    throw new Error(
      `expected a translated row in each guide section, found none in ${empty.map(({ section }) => section.heading).join(', ')}`
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

Godot draws this shader. A plain three.js page draws the translation of its function \`pattern\` with the same UV. \`pnpm test:shaders:e2e\` draws both again and fails on any pixel over 2/255 apart.

\`\`\`glsl
${godotShader(showcase).trim()}
\`\`\`

| Godot | Translation on three.js |
| --- | --- |
| ${image('godot', 'Godot')} | ${image('three', 'Translation')} |
`;
}

function renderChapter({ chapter, sections }, probes, record, showcases) {
  const chapterShowcases = showcases.filter((showcase) => showcase.chapter === chapter.file);
  return `# ${chapter.title}

${chapter.intro}

Godot ${record.godot}, probed on ${record.adapter}. Each table shows at most ${SAMPLE_ROWS} of a probe's rows, picked to show as many mixes of zero, subnormal, normal, infinite and NaN values as fit. The real-GL test (\`pnpm test:shaders:gpu\`) checks every row, bit for bit. Generated by \`pnpm godot:shader-language\`: do not edit by hand.

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
    `The translation draws in headless Chromium, WebGL 2 through ANGLE on Vulkan over the same lavapipe, ` +
    `and the run stops when the browser reports another renderer. "Bit-equal" is a claim about that pair.`
  );
}

function renderIndex(placed, rows, probes, record) {
  const translated = translatedIds(probes);
  const families = [...new Set(rows.map((row) => row.family))];
  const familyLines = families.map((family) => {
    const familyRows = rows.filter((row) => row.family === family);
    const done = familyRows.filter((row) => translated.has(row.id)).length;
    const owners = [...new Set(familyRows.filter((row) => !translated.has(row.id)).map(owningIssue))];
    return `| ${family} | ${done} of ${familyRows.length} | ${owners.join(', ') || 'none'} |`;
  });
  const chapterLines = placed.map(
    ({ chapter, sections }) =>
      `- [${chapter.title}](${chapter.file}): ${sections.map(({ section }) => section.heading).join(', ')}.`
  );
  return `# The shading language translator

\`@textscene/three-godot-shaders\` translates Godot 4.6.3's shading language to three.js TSL nodes, instruction by instruction. This guide explains each instruction the translator reads, with the values Godot gave for it. A text that uses an instruction not translated yet fails with an error that names the instruction and the issue that translates it.

${translated.size} of ${rows.length} instructions translated. [INSTRUCTIONS.md](../INSTRUCTIONS.md) lists every row with its state. Generated by \`pnpm godot:shader-language\`: do not edit by hand.

${rowCountNote(rows)}

${driversNote(record)}

## Chapters

${chapterLines.join('\n')}

## Coverage by family

| Family | Translated | Open rows owned by |
| --- | --- | --- |
${familyLines.join('\n')}
`;
}

/** The guide's files: `[name, text]` for the index and each chapter. */
export function renderGuide({ chapters, rows, probes, record, showcases = [] }) {
  const placed = chapterSections(chapters, rows, probes);
  return [
    ['README.md', renderIndex(placed, rows, probes, record)],
    ...placed.map((entry) => [entry.chapter.file, renderChapter(entry, probes, record, showcases)]),
  ];
}
