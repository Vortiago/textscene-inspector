#!/usr/bin/env node
/**
 * The template check of the shader package: `pnpm test:shaders:templates`. Every stage of every
 * template of Godot's renderer is preprocessed and parsed under define sets that take each `#if`
 * branch, and printed back to GLSL. Godot compiles its own text of each variant and the printed
 * text: where Godot compiles the variant, the two must give the same SPIR-V, and where Godot
 * refuses it, the transpiler must refuse it too. A branch that no variant Godot compiles takes fails.
 */

import { createServer } from 'vite';
import { godotSourceDir } from '../../../../scripts/godotSource.mjs';
import {
  printedField,
  requireGodotVersion,
  runGodotScript,
} from '../../../../scripts/godot-probes/godotRun.mjs';
import { REPO_ROOT } from '../../../../scripts/repoRoot.mjs';
import { writeJobSummary } from '../consumer.mjs';
import { StageVariants, templateFiles } from './templateCases.mjs';

const TEMPLATE = '/packages/textscene-core/src/shaders/template/';

/** The transpiler's template front end, which Vite compiles from its TypeScript sources. */
async function loadFrontEnd() {
  const server = await createServer({
    root: REPO_ROOT,
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const load = (file) => server.ssrLoadModule(`${TEMPLATE}${file}`);
    const [stages, variant, preprocess, parse, print] = await Promise.all(
      ['stages.ts', 'variant.ts', 'preprocess.ts', 'parseTemplate.ts', 'printTemplate.ts'].map(load)
    );
    return { ...stages, ...variant, ...preprocess, ...parse, ...print };
  } finally {
    await server.close();
  }
}

/** Godot's `RenderingDevice` compiles each text of a stage to SPIR-V and prints its digest or error. */
const COMPILE_SCRIPT = `extends Node

func _ready() -> void:
	var items: Array = JSON.parse_string(FileAccess.get_file_as_string("res://glsl.json"))
	print("GODOT ", Engine.get_version_info().string)
	var rd := RenderingServer.get_rendering_device()
	for item in items:
		var source := RDShaderSource.new()
		source.language = RenderingDevice.SHADER_LANGUAGE_GLSL
		var stage: int = int(item["stage"])
		source.set_stage_source(stage, item["text"])
		var spirv := rd.shader_compile_spirv_from_source(source)
		var bytes := spirv.get_stage_bytecode(stage)
		var ctx := HashingContext.new()
		ctx.start(HashingContext.HASH_SHA256)
		ctx.update(bytes)
		print("GLSL ", JSON.stringify({"error": spirv.get_stage_compile_error(stage), "sha": ctx.finish().hex_encode() if bytes.size() > 0 else ""}))
	get_tree().quit()
`;

/** `RenderingDevice.ShaderStage` of each stage name. */
const STAGE_NUMBERS = { vertex: 0, fragment: 1, compute: 4 };

/** Godot's answer for each text: its SPIR-V digest, or its error. */
async function compiledInGodot(texts) {
  const items = texts.map(({ stage, text }) => ({ stage: STAGE_NUMBERS[stage], text }));
  const stdout = await runGodotScript(COMPILE_SCRIPT, { 'glsl.json': JSON.stringify(items) });
  requireGodotVersion(printedField(stdout, 'GODOT '));
  const answers = stdout
    .split('\n')
    .filter((line) => line.startsWith('GLSL '))
    .map((line) => JSON.parse(line.slice(5)));
  if (answers.length !== texts.length)
    throw new Error(`expected ${texts.length} answers from Godot, found ${answers.length}`);
  return answers;
}

/** The verdict of one case against Godot's answers for its two texts. */
function verdict(entry, original, printed) {
  const name = `${entry.stages.key} [${entry.set.join(' ')}]`;
  if (original.error) {
    if (entry.refusal !== undefined) return { name, isCompiled: false };
    return {
      name,
      isCompiled: false,
      failure: `Godot refuses the variant, the transpiler parses it: ${original.error.split('\n')[1] ?? ''}`,
    };
  }
  if (entry.refusal !== undefined)
    return { name, isCompiled: true, failure: `the transpiler refuses it: ${entry.refusal}` };
  if (printed.error)
    return {
      name,
      isCompiled: true,
      failure: `Godot refuses the printed text: ${printed.error.split('\n')[1] ?? ''}`,
    };
  if (printed.sha !== original.sha)
    return { name, isCompiled: true, failure: 'the printed text gives other SPIR-V' };
  return { name, isCompiled: true };
}

/** How many times the check widens a set Godot refuses by one name, to take a branch. */
const WIDENING_ROUNDS = 3;

/** Each case with Godot's answers for its two texts and its verdict. */
async function judged(cases) {
  const texts = cases.flatMap((entry) => [
    { stage: entry.stages.stage, text: entry.original },
    { stage: entry.stages.stage, text: entry.printed ?? '' },
  ]);
  const answers = await compiledInGodot(texts);
  return cases.map((entry, index) => {
    const [original, printed] = [answers[2 * index], answers[2 * index + 1]];
    return { ...entry, error: original.error, ...verdict(entry, original, printed) };
  });
}

/** The branches of each stage that no case Godot compiles takes, by the stage's key. */
function untakenBranches(stageList, results) {
  const untaken = new Map(stageList.map((stages) => [stages.key, stages.allBranches()]));
  for (const result of results.filter((entry) => entry.isCompiled))
    for (const key of result.branches) untaken.get(result.stages.key).delete(key);
  return untaken;
}

/**
 * How many wider sets the check tries for one untaken branch in a round. Godot compiles each, and
 * a template of 60 names gives thousands of them.
 */
const WIDENED_PER_BRANCH = 2;

/**
 * The cases that widen a set to take an untaken branch, a few for each branch, none judged before.
 * A set Godot refuses that takes the branch is widened first, then a set that decides it.
 */
function widenedCases(results, untaken) {
  const seen = new Set(results.map((entry) => `${entry.stages.key} ${entry.set.join(' ')}`));
  const cases = [];
  for (const [stageKey, keys] of untaken)
    for (const key of keys) {
      const ofStage = results.filter((entry) => entry.stages.key === stageKey);
      const refused = ofStage.filter((entry) => !entry.isCompiled && entry.branches.has(key));
      const deciding = ofStage.filter((entry) => entry.stages.decides(entry.set, key));
      cases.push(...unseenWider([...refused, ...deciding], key, seen));
    }
  return cases;
}

/** At most `WIDENED_PER_BRANCH` cases of sets wider than those of `entries` that take `key`, none in `seen`. */
function unseenWider(entries, key, seen) {
  const cases = [];
  for (const entry of entries)
    for (const set of entry.stages.widenedSets(entry.set, key)) {
      if (cases.length >= WIDENED_PER_BRANCH) return cases;
      const id = `${entry.stages.key} ${set.join(' ')}`;
      if (seen.has(id)) continue;
      seen.add(id);
      cases.push(entry.stages.caseOf(set));
    }
  return cases;
}

/** The first error of Godot's refusal of a case that takes `key`, for the report. */
function refusalTaking(results, stageKey, key) {
  const refused = results.find(
    (entry) => entry.stages.key === stageKey && !entry.isCompiled && entry.branches.has(key)
  );
  if (!refused) return 'no define set takes it';
  const error = refused.error.split('\n').find((line) => line.startsWith('ERROR')) ?? '';
  return `Godot refuses [${refused.set.join(' ')}]: ${error}`;
}

async function main() {
  const godotDir = godotSourceDir(process.argv);
  const frontEnd = await loadFrontEnd();
  const { templates, includes, waiting } = templateFiles(godotDir, frontEnd);
  const stageList = templates.flatMap(({ file, stages }) =>
    Object.entries(stages).map(([stage, lines]) => new StageVariants(file, stage, lines, frontEnd))
  );
  const results = await judged(stageList.flatMap((stages) => stages.coveringCases()));
  for (let round = 0; round < WIDENING_ROUNDS; round += 1) {
    const widened = widenedCases(results, untakenBranches(stageList, results));
    if (widened.length === 0) break;
    results.push(...(await judged(widened)));
  }
  const untaken = [...untakenBranches(stageList, results)].flatMap(([stageKey, keys]) =>
    [...keys].map((key) => `${stageKey}: ${key} (${refusalTaking(results, stageKey, key)})`)
  );
  const failures = results.filter((entry) => entry.failure);
  const compiled = results.filter((entry) => entry.isCompiled).length;
  const equal = compiled - failures.filter((entry) => entry.isCompiled).length;
  const report = [
    `${templates.length} templates with stages, ${includes.length} files only included, ${waiting.length} waiting for the third-party code: ${waiting.join(', ')}.`,
    `${results.length} variants: Godot compiles ${compiled}, and ${equal} of those give Godot's SPIR-V from the printed tree.`,
    `${untaken.length} branches that no variant Godot compiles takes.`,
    ...failures.map((entry) => `FAILS ${entry.name}: ${entry.failure}`),
    ...untaken.map((line) => `UNTAKEN ${line}`),
  ];
  console.log(report.join('\n'));
  writeJobSummary(['## Godot templates', '', ...report.map((line) => `- ${line}`)].join('\n'));
  if (failures.length > 0 || untaken.length > 0) process.exitCode = 1;
}

await main();
