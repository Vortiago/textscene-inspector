/**
 * The chapter of the user guide on how the tests check the transpiler against Godot: the
 * operator rules in full, the random programs and the corpus of real shaders. Its counts come
 * from Godot's records, the known lists and the corpus states, so it is stale only when they
 * change.
 */

export const TESTING_FILE = 'testing.md';

const count = (items, test) => items.filter(test).length;

function operatorSection(operatorCases, operatorRecord) {
  const accepted = count(operatorCases, (test) => operatorRecord.cases[test.id] === 'accepted');
  const rows = count(operatorCases, (test) => test.row !== undefined);
  return `## Every operator rule against Godot

One one-line shader for each of Godot's typed operators and each tuple of the value types \`bool\` to \`mat4\`: ${operatorCases.length.toLocaleString('en-GB')} shaders. Godot ${operatorRecord.godot.replace(/-stable.*/, '')} accepts ${accepted} of them. The instruction table has ${rows} operator rows, read from \`_validate_operator\` by an interpreter of its C++ (\`scripts/godot-shader-language/operatorRules.mjs\`), and the test fails when one case has a row and Godot refuses it, or the reverse.

The same cases go through the transpiler's front end. On each one, it accepts what Godot accepts, refuses with Godot's message, or names the issue that translates the operator. Any other answer fails the test.`;
}

function knownDifferenceRows(knownDifferences) {
  return Object.entries(knownDifferences).map(
    ([name, known]) =>
      `| \`${name}\` | \`${known.reduced}\` | ${known.lane} | ${known.cause} | ${known.owner} |`
  );
}

function randomSection({ programs, seed, translatedRows, knownDifferences }) {
  const known = Object.keys(knownDifferences).length;
  return `## Random programs against Godot

A generator writes random functions that are correct by type, from the signatures of the translated rows only, so each slice that translates rows gets random programs over them with no change to the generator. Operators take only the brackets Godot's priorities need, so a program tests the order of evaluation as a user's shader does.

The fixed set has seed ${seed}: ${programs.length} programs, one rooted at each of the ${translatedRows} translated rows, and the rest with random roots. Godot accepts every one. \`pnpm godot:probes\` records Godot's result bits, and \`pnpm test:shaders:gpu\` runs the translation of each program on a real GL context and compares the bits, as for a probe. There is no tolerance: a lane passes when its bits equal Godot's, or when both are NaN.

**${programs.length - known} of ${programs.length} random programs bit-equal with Godot.** A program that differs is reduced against a live Godot to a small program that still differs. The ${known} that differ now are listed below with their owner. The list only shrinks: a program that differs and is not listed fails the run, and a listed program that equals Godot fails it too.

| Program | Reduced program | First lane that differs | Cause | Owner |
| --- | --- | --- | --- | --- |
${knownDifferenceRows(knownDifferences).join('\n')}

\`pnpm test:shaders:random --seed <n> --count <n>\` runs more programs with another seed against a live Godot, for a developer. No pipeline runs it.`;
}

/** The corpus shaders by state, the not translated yet ones by owner. */
function stateCounts(states) {
  const byState = new Map();
  for (const state of Object.values(states)) byState.set(state, (byState.get(state) ?? 0) + 1);
  return [...byState].sort((a, b) => b[1] - a[1]);
}

function corpusSection({ corpus, corpusRecord, states, knownMismatches }) {
  const accepted = corpus.filter((shader) => corpusRecord.cases[shader.id] === 'accepted');
  const translated = count(accepted, (shader) => states[shader.id] === 'translated');
  const sources = [...new Set(corpus.map((shader) => shader.id.replace(/^rejected\//, '').split('/')[0]))];
  const sourceLines = sources.map((source) => {
    const shaders = corpus.filter((shader) => shader.id.replace(/^rejected\//, '').startsWith(`${source}/`));
    const types = [...new Set(shaders.map((shader) => shader.shaderType))].join(', ');
    return `| ${source} | ${count(shaders, (shader) => !shader.changedFrom)} | ${count(shaders, (shader) => shader.changedFrom)} | ${types} |`;
  });
  const stateLines = stateCounts(states).map(([state, number]) => `| ${state} | ${number} |`);
  const openLines = corpus
    .filter((shader) => states[shader.id]?.startsWith('not translated yet'))
    .map(
      (shader) => `| \`${shader.id}\` | ${states[shader.id].replace(/^not translated yet \((.*)\)$/, '$1')} |`
    );
  const mismatchLines = Object.entries(knownMismatches).map(
    ([id, known]) => `| \`${id}\` | ${known.cause} | ${known.owner} |`
  );
  return `## A corpus of real shaders against Godot

The instruction count says how much of the language is translated, not how many real shaders translate: one open row stops a whole shader. The corpus holds whole shaders of all five types, each with its source and licence (\`tests/corpus/corpus.json\`, \`tests/corpus/NOTICE.md\`): the text Godot's material generators write over a sweep of their flags, the shaders of Godot's demo projects and documentation, this repository's fixtures, and one shader made by one change to each of them. \`pnpm shaders:corpus\` collects them, and \`pnpm godot:probes\` records Godot's verdict on each: accepted, or Godot's message and line.

| Source | Shaders | Made by one change | Types |
| --- | --- | --- | --- |
${sourceLines.join('\n')}

**${translated} of ${accepted.length} real shaders translate.** Godot rejects the other ${corpus.length - accepted.length}. Each shader ends in one of three states: translated, refused as Godot refuses with the same message and line, or not translated yet, where the transpiler names the open row and its owner. Any other outcome fails the test. A shader never moves back from translated or from refused as Godot refuses, so the shaders not translated yet only grow fewer.

| State | Shaders |
| --- | --- |
${stateLines.join('\n')}

The mismatches below are known, each with its owner. The list only shrinks, as for the random programs.

| Shader | Cause | Owner |
| --- | --- | --- |
${mismatchLines.join('\n')}

<details><summary>The ${openLines.length} shaders not translated yet, with their owners</summary>

| Shader | Owner |
| --- | --- |
${openLines.join('\n')}

</details>`;
}

/** The text of the chapter. */
export function renderTestingGuide({ operators, random, corpus }) {
  return `# How the tests check the transpiler against Godot

A probe checks one instruction on a table of inputs. Three more tests check what probes cannot: every operator rule, instructions combined in random programs, and whole shaders from the wild. Godot 4.6.3 is the judge of each, through its recorded answers. Generated by \`pnpm godot:shader-language\`: do not edit by hand.

${operatorSection(operators.cases, operators.record)}

${randomSection(random)}

${corpusSection(corpus)}
`;
}
