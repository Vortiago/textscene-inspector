#!/usr/bin/env node
/**
 * Runs every probe and the fixed-seed random programs in Godot 4.6.3 and writes Godot's answers
 * to the checked-in records: the result bits, or Godot's message and line for a probe it draws
 * nothing for, and Godot's verdict on each operator case and corpus shader:
 * `pnpm godot:probes [--check]`. `--check` writes nothing and exits 1 when a new run differs from
 * a record. A result entry that agrees with its record by the lane rule (`laneAgreement.mjs`)
 * keeps its recorded bits. It needs `godot` on the path and `xvfb-run`, and renders on lavapipe as
 * `pnpm ref:godot` does. The CI image has both, so the "Shader package" job runs `--check`. Each
 * probe the transpiler parses also runs as its printed text, and as its lowered text where the
 * lowerings change it, and the run fails when Godot answers either otherwise than the original
 * (`printedText.mjs`).
 * `--keep-stale <dir>` with `--check` copies each stale record and this run's text for it into
 * `<dir>/recorded` and `<dir>/this-run`, so a job can keep both value sets.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CORPUS } from '../../apps/textscene-three-godot-shaders/tests/corpus/corpus.mjs';
import { OPERATOR_CASES } from '../../apps/textscene-three-godot-shaders/tests/operators/operatorCases.mjs';
import { PROBES } from '../../apps/textscene-three-godot-shaders/tests/probes/probes.mjs';
import {
  KNOWN_DIFFERENCE_CASES,
  recordedRandomProbes,
} from '../../apps/textscene-three-godot-shaders/tests/random/knownDifferences.mjs';
import { RANDOM_PROGRAMS } from '../../apps/textscene-three-godot-shaders/tests/random/randomSet.mjs';
import { checkGenerated, writeGenerated } from '../generatedFile.mjs';
import { REPO_ROOT } from '../repoRoot.mjs';
import { runProbesInGodot } from './godotProject.mjs';
import { requireGodotVersion } from './godotRun.mjs';
import { recordKeepingAgreeingEntries } from './laneAgreement.mjs';
import { isDrawn, renderRecord } from './record.mjs';
import { loadPrinter, printedProbes, printedRejection, printedTextFaults } from './printedText.mjs';
import { godotRejection } from './rejection.mjs';
import { godotVerdicts, renderVerdictRecord } from './shaderVerdicts.mjs';

const TESTS = join(REPO_ROOT, 'apps/textscene-three-godot-shaders/tests');
const RECORD = join(TESTS, 'probes/godot-record.json');
const OPERATOR_RECORD = join(TESTS, 'operators/godot-verdicts.json');
const RANDOM_RECORD = join(TESTS, 'random/godot-record.json');
const CORPUS_RECORD = join(TESTS, 'corpus/godot-verdicts.json');

/** The record of Godot's verdict on each case of each set, `{ id, text }`, from one Godot run. */
function verdictRecords(...sets) {
  const cases = sets.flat();
  const { godot, verdicts } = godotVerdicts(cases.map((each) => each.text));
  requireGodotVersion(godot);
  let next = 0;
  return sets.map((set) => {
    const ofSet = verdicts.slice(next, (next += set.length));
    return renderVerdictRecord(
      godot,
      set.map((each) => each.id),
      ofSet
    );
  });
}

/**
 * Godot's reason for each probe it draws nothing for, by name, from a run of each alone. A probe
 * that ends Godot runs alone from the start, since it would end the run of every probe.
 */
function rejections(probes, { pixels }) {
  const rejected = probes.filter((probe) => probe.endsGodot || !isDrawn(probe, pixels.get(probe.name)));
  return new Map(
    rejected.map((probe) => [probe.name, probe.original ? printedRejection(probe) : endingRejection(probe)])
  );
}

/** Godot's reason for `probe`, which must be a crash exactly when the probe says it ends Godot. */
function endingRejection(probe) {
  const rejection = godotRejection(probe);
  if ((rejection.stage === 'Godot') !== Boolean(probe.endsGodot))
    throw new Error(
      `expected ${probe.name} ${probe.endsGodot ? 'to end' : 'not to end'} Godot, got: ${rejection.message}`
    );
  return rejection;
}

async function main() {
  const randomProbes = recordedRandomProbes(RANDOM_PROGRAMS);
  const printer = await loadPrinter();
  const lowered = printedProbes([...PROBES, ...randomProbes], printer.lower, 'lowered');
  const printed = [...printedProbes([...PROBES, ...randomProbes], printer.print), ...lowered];
  const probes = [...PROBES, ...randomProbes, ...printed];
  const output = runProbesInGodot(probes.filter((probe) => !probe.endsGodot));
  const reasons = rejections(probes, output);
  const [operatorRecord, corpusRecord] = verdictRecords(
    OPERATOR_CASES.map(({ id, godotText }) => ({ id, text: godotText })),
    CORPUS
  );
  const outputs = [
    [RECORD, keptRecord(RECORD, renderRecord(output, PROBES, reasons))],
    [RANDOM_RECORD, keptRecord(RANDOM_RECORD, renderRecord(output, randomProbes, reasons))],
    [OPERATOR_RECORD, operatorRecord],
    [CORPUS_RECORD, corpusRecord],
  ];
  const summary = `${PROBES.length} probes, ${RANDOM_PROGRAMS.length} random programs, ${KNOWN_DIFFERENCE_CASES.length} known-difference cases, ${OPERATOR_CASES.length} operator cases, ${CORPUS.length} corpus shaders, ${printed.length - lowered.length} printed texts, ${lowered.length} of them lowered`;
  const options = { tool: 'godot-probes', summary };
  if (process.argv.includes('--check')) check(outputs, options);
  else writeGenerated(outputs, options);
  failOnPrintedText(printedTextFaults(printed, output, reasons));
}

/** This run's record for `path`, with each entry that agrees with the recorded one kept as recorded. */
const keptRecord = (path, runText) =>
  recordKeepingAgreeingEntries(existsSync(path) ? readFileSync(path, 'utf8') : undefined, runText);

function check(outputs, options) {
  checkGenerated(outputs, { ...options, command: 'pnpm godot:probes' });
  const keepDir = optionValue('--keep-stale');
  if (keepDir) keepStaleRecords(outputs, keepDir);
}

/** Fails the run on each probe whose printed or lowered text Godot answers otherwise than the original. */
function failOnPrintedText(faults) {
  for (const fault of faults) console.error(`[godot-probes] ${fault}`);
  if (faults.length > 0) process.exitCode = 1;
}

/** The value after `name` on the command line, or nothing. */
function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

/**
 * Copies each record this run disagrees with, and this run's text for it, under `dir`. A record
 * that went stale on one runner only is lost with the runner unless a job keeps both.
 */
function keepStaleRecords(outputs, dir) {
  for (const [path, text] of outputs) {
    const recorded = readFileSync(path, 'utf8');
    if (recorded === text) continue;
    const inRepo = relative(REPO_ROOT, path);
    writeInto(join(dir, 'recorded', inRepo), recorded);
    writeInto(join(dir, 'this-run', inRepo), text);
  }
}

function writeInto(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

// `pathToFileURL`, not a `file://` template: on Windows `process.argv[1]` is a `C:\...` path.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
