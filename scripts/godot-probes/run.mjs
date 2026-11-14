#!/usr/bin/env node
/**
 * Runs every probe, the fixed-seed random programs, the operator cases and the corpus in Godot
 * 4.6.3, and writes Godot's answers: `pnpm godot:probes [--check]`. Each family's answers go to
 * the ignored `tests/.godot-answers/`, where the tests and the guide read them. The committed
 * `tests/godot-answers.json` holds Godot's version, a digest of each family and the smoke subset
 * (`answerDigest.mjs`). `--check` writes the live answers but not the committed file, and exits 1
 * when the committed file differs from this run's. It needs `godot` on the path and `xvfb-run`,
 * and renders on lavapipe as `pnpm ref:godot` does. Each probe the transpiler parses also runs
 * as its printed text, and as its lowered text where the lowerings change it, and the run fails
 * when Godot answers either otherwise than the original (`printedText.mjs`).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { CORPUS } from '../../apps/textscene-three-godot-shaders/tests/corpus/corpus.mjs';
import { OPERATOR_CASES } from '../../apps/textscene-three-godot-shaders/tests/operators/operatorCases.mjs';
import { PROBES } from '../../apps/textscene-three-godot-shaders/tests/probes/probes.mjs';
import {
  ANSWERS_FILE,
  LIVE_DIR,
  livePath,
} from '../../apps/textscene-three-godot-shaders/tests/godotAnswers.mjs';
import {
  KNOWN_DIFFERENCE_CASES,
  recordedRandomProbes,
} from '../../apps/textscene-three-godot-shaders/tests/random/knownDifferences.mjs';
import { RANDOM_PROGRAMS } from '../../apps/textscene-three-godot-shaders/tests/random/randomSet.mjs';
import { checkGenerated, writeGenerated } from '../generatedFile.mjs';
import { runProbesInGodot } from './godotProject.mjs';
import { requireGodotVersion } from './godotRun.mjs';
import { renderAnswersFile } from './answerDigest.mjs';
import { isDrawn, probeRecord } from './record.mjs';
import { loadPrinter, printedProbes, printedRejection, printedTextFaults } from './printedText.mjs';
import { frontEndRejections, godotRejection } from './rejection.mjs';
import { godotVerdicts, verdictRecord } from './shaderVerdicts.mjs';

/** The record of Godot's verdict on each case of each set, `{ id, text }`, from one Godot run. */
function verdictRecords(...sets) {
  const cases = sets.flat();
  const { godot, verdicts } = godotVerdicts(cases.map((each) => each.text));
  requireGodotVersion(godot);
  let next = 0;
  return sets.map((set) => {
    const ofSet = verdicts.slice(next, (next += set.length));
    return verdictRecord(
      godot,
      set.map((each) => each.id),
      ofSet
    );
  });
}

/**
 * Godot's reason for each probe it draws nothing for, by name. One verdict run gives the reason of
 * every probe the front end refuses, and each other probe runs alone. A probe that ends Godot runs
 * alone from the start, since it would end the run of every probe.
 */
function rejections(probes, { pixels }) {
  const rejected = probes.filter((probe) => probe.endsGodot || !isDrawn(probe, pixels.get(probe.name)));
  const frontEnd = frontEndRejections(rejected.filter((probe) => !probe.endsGodot));
  return new Map(
    rejected.map((probe) => [
      probe.name,
      frontEnd.get(probe.name) ?? (probe.original ? printedRejection(probe) : endingRejection(probe)),
    ])
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
  const records = {
    probes: probeRecord(output, PROBES, reasons),
    random: probeRecord(output, randomProbes, reasons),
    operators: operatorRecord,
    corpus: corpusRecord,
  };
  writeLiveAnswers(records);
  const answersFile = renderAnswersFile(records);
  const summary = `${PROBES.length} probes, ${RANDOM_PROGRAMS.length} random programs, ${KNOWN_DIFFERENCE_CASES.length} known-difference cases, ${OPERATOR_CASES.length} operator cases, ${CORPUS.length} corpus shaders, ${printed.length - lowered.length} printed texts as parsed and ${lowered.length} as lowered`;
  const options = { tool: 'godot-probes', summary };
  const outputs = [[ANSWERS_FILE, answersFile]];
  if (process.argv.includes('--check')) checkGenerated(outputs, { ...options, command: 'pnpm godot:probes' });
  else writeGenerated(outputs, options);
  failOnPrintedText(printedTextFaults(printed, output, reasons));
}

/** Writes each family's record of this run to the ignored live directory. */
function writeLiveAnswers(records) {
  mkdirSync(LIVE_DIR, { recursive: true });
  for (const [family, record] of Object.entries(records))
    writeFileSync(livePath(family), `${JSON.stringify(record, null, 1)}\n`);
}

/** Fails the run on each probe whose printed or lowered text Godot answers otherwise than the original. */
function failOnPrintedText(faults) {
  for (const fault of faults) console.error(`[godot-probes] ${fault}`);
  if (faults.length > 0) process.exitCode = 1;
}

// `pathToFileURL`, not a `file://` template: on Windows `process.argv[1]` is a `C:\...` path.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
