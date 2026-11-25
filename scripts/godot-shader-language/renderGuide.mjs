import { isFunctionRow } from '../../packages/textscene-core/src/shaders/language/instructionFamily.ts';
import { godotShader } from '../../apps/textscene-three-godot-shaders/tests/e2e/showcases.mjs';
import { floatOfBits } from '../../apps/textscene-three-godot-shaders/tests/probes/inputs.mjs';
import { PROBE_TYPES, probeSignature } from '../godot-probes/probeShader.mjs';
import { owningIssue, transpiledIds } from './renderTable.mjs';
import { targetStates, WEBGPU_STATE } from './targetStates.mjs';
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

/** Normal values first, then each row that shows the most new kinds of value at a new place. */
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

/** One line when every row is native on both targets, each lowered row by name otherwise. */
function statesText(rows) {
  const lowered = rows
    .map((row) => ({ row, states: targetStates(row) }))
    .filter(({ states }) => states.webgl2 !== 'native');
  const untested = `WebGPURenderer runs the same nodes and is ${WEBGPU_STATE}.`;
  if (lowered.length === 0) return `Every row is native on WebGL 2. ${untested}`;
  const lines = lowered.map(({ row, states }) => `- \`${row.id}\`: WebGL 2 ${states.webgl2}.`);
  const rest = lowered.length === rows.length ? '' : ' The other rows are native on WebGL 2.';
  return `Lowered rows:\n\n${lines.join('\n')}\n\n${rest.trim()} ${untested}`.trim();
}

/** A form with code spans of its own is prose. Any other is one expression, which takes a code span. */
const emittedForm = (form) => (form.includes('`') ? form : `\`${form}\``);

function renderSection(section, rows, probes, record) {
  const ids = new Set(rows.map((row) => row.id));
  // A sky or canvas scene and a head case have no table of inputs: a showcase and a verdict prove their rows.
  const sectionProbes = probes.filter(
    (probe) =>
      !probe.camera &&
      !probe.kind &&
      !probe.isVerdictCase &&
      probe.rows.some((id) => ids.has(id)) &&
      (section.probes?.(probe) ?? true)
  );
  const rowList = rows.map((row) => `\`${row.id}\``).join(', ');
  return `## ${section.heading}

${section.what}

The transpiler emits ${emittedForm(section.tsl)}. Rows: ${rowList}. Godot source: \`${rows[0].source}\`.

${statesText(rows)}

${sectionProbes.map((probe) => renderProbe(probe, record)).join('\n')}`;
}

/** Throws for a transpiled row no section holds, and for a section with no transpiled row. */
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

/** What Godot draws of a canvas scene of each kind, with no material. */
const CANVAS_DRAWS = {
  rect: "the scene's rects on a Node2D",
  primitive: "the scene's `draw_primitive` calls on a Node2D",
  polygon: 'a Polygon2D',
  drawPolygon: "the scene's `draw_polygon` call on a Node2D",
  mesh: 'an ArrayMesh of 2D vertices on a MeshInstance2D',
  ninepatch: 'a `canvas_item_add_nine_patch` on a Node2D',
};

/** What Godot draws of a canvas scene, the target it draws to, and the shader it draws with. */
function canvasText({ kind, linear, rows }) {
  const target = linear ? ' with `use_hdr_2d`, whose image holds linear colours' : '';
  const shader = rows
    ? 'with a ShaderMaterial of this shader'
    : "with no material, so Godot's default canvas shader draws it";
  return `Godot draws ${CANVAS_DRAWS[kind]} of a 2D view${target}, ${shader} (\`tests/e2e/canvasScenes.mjs\`). A plain three.js page draws the same commands through the transpiled canvas template with the same values.`;
}

/** What the page draws of a showcase: a function of UV, a sky, a mesh, or a canvas item. */
function showcaseText(showcase) {
  if (showcase.kind) return canvasText(showcase);
  if (showcase.mesh)
    return "Godot draws this spatial shader on a mesh of a 3D view, with the scene's camera (`tests/e2e/meshScenes.mjs`). A plain three.js page draws the transpiled material on the same mesh with the same values.";
  if (showcase.camera)
    return "Godot draws this sky shader as a 3D view's background, with the scene's camera, fog and directional lights (`tests/e2e/skyScenes.mjs`). A plain three.js page draws the transpiled sky with the same values.";
  return 'Godot draws this shader. A plain three.js page draws the transpilation of its function `pattern` with the same UV.';
}

function renderShowcase(showcase) {
  const image = (side, label) =>
    `<img src="showcase/${showcase.name}-${side}.png" width="${showcase.width * SHOWCASE_SCALE}" alt="${label}">`;
  return `## Showcase \`${showcase.name}\`

${showcaseText(showcase)} \`pnpm test:shaders:e2e\` draws both again and fails on any pixel over 2/255 apart.

\`\`\`glsl
${(showcase.camera || showcase.kind ? showcase.source : godotShader(showcase)).trim()}
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
  const functions = formsOf((family) => isFunctionRow({ family }));
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
    `and the run stops when the browser reports another renderer. "Bit-equal" is a claim about that pair. ` +
    `Every probe is bit-equal with Godot. The random programs are bit-equal with Godot except the listed ` +
    `driver and undefined-behaviour cases, each with its cause in [testing.md](testing.md).`
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
      `- [${chapter.title}](${chapter.file}): ${sections.map(({ section }) => section.heading).join(', ') || chapter.contents}.`
  );
  return `# The shading language transpiler

\`@textscene/three-godot-shaders\` transpiles Godot ${version}'s shading language to three.js TSL nodes, instruction by instruction. It builds TSL node objects and writes no GLSL or WGSL text, and \`shaderTextRule.test.ts\` enforces that rule. This guide explains each instruction the transpiler reads, with the values Godot gave for it. A text that uses an instruction not transpiled yet fails with an error that names the instruction and the issue that transpiles it.

One Godot version: the previewer draws every project as Godot ${version} draws it. The transpiler reads every shader with the rules of Godot ${version}, not of the version a project's \`project.godot\` names.

${transpiled.size} of ${rows.length} instructions transpiled. [INSTRUCTIONS.md](../INSTRUCTIONS.md) lists every row with its state. Generated by \`pnpm godot:shader-language\`: do not edit by hand.

${rowCountNote(rows)}

${driversNote(record)}

## Install

\`installGodotShading(renderer, { renderingMethod })\` gives a \`WebGLRenderer\` three's nodes handler and answers the shading of the project. Pass the project's \`rendering/renderer/rendering_method\`: \`forward_plus\` when left out. Pass the value as the project writes it. Godot draws a name of no renderer, such as \`Forward_Plus\` or an empty one, with Forward+, but its preprocessor defines \`CURRENT_RENDERER\` as the Compatibility renderer and it refuses \`hint_normal_roughness_texture\`. The shading does the same. \`shading.spatial(text)\` gives the material of a spatial shader, and \`shading.sky(text)\` the draws of a sky. Each parses the text with the rendering method, and on \`gl_compatibility\` with the varying slots of the renderer's GL context, so a text gets the verdict Godot gives it on that renderer. \`output: 'linear'\` writes the lit colour for an app that tone maps and encodes the frame itself.

## Errors

The transpiler gives two errors, and each says who is at fault.

- \`ShadingLanguageError\`: Godot refuses the text too. It holds Godot's message and the line of the text. The shading's \`spatial\` and \`sky\`, \`transpileSpatial\`, \`transpileSky\` and \`transpileShadingLanguage\` throw it.
- \`TranslatorFault\`: the GPU refuses the program for a text Godot compiles, so the transpiler is at fault. It holds \`source.text\`, the preprocessed text, \`source.file\`, the shader's address, and \`log\`, the link log of the driver and the log of each stage that has one.

three reports a refused program when it first uses it, in a draw or in \`compile\` and \`compileAsync\`. \`installGodotShading\` gives the fault to \`onTranslatorFault\` of each transpiled material three built that program for, and to \`console.error\` when that hook is null. A hook in \`renderer.debug.onShaderError\`, set before or after \`installGodotShading\`, still gets every refused program. With no such hook, a program of another material gets three's own report.

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
