#!/usr/bin/env node
/**
 * Runs every probe and the fixed-seed random programs in Godot 4.6.3 and writes Godot's answers
 * to the checked-in records: the result bits, or Godot's message and line for a probe it draws
 * nothing for, and Godot's verdict on each operator case and corpus shader:
 * `pnpm godot:probes [--check]`. `--check` writes nothing and exits 1 when a new run differs from
 * a record. It needs `godot` on the path and `xvfb-run`, and renders on lavapipe as
 * `pnpm ref:godot` does. The CI image has both, so the "Shader package" job runs `--check`.
 */

import { join } from 'node:path';
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
import { isDrawn, renderRecord } from './record.mjs';
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
  return new Map(rejected.map((probe) => [probe.name, endingRejection(probe)]));
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

function main() {
  const randomProbes = recordedRandomProbes(RANDOM_PROGRAMS);
  const probes = [...PROBES, ...randomProbes];
  const output = runProbesInGodot(probes.filter((probe) => !probe.endsGodot));
  const reasons = rejections(probes, output);
  const [operatorRecord, corpusRecord] = verdictRecords(
    OPERATOR_CASES.map(({ id, godotText }) => ({ id, text: godotText })),
    CORPUS
  );
  const outputs = [
    [RECORD, renderRecord(output, PROBES, reasons)],
    [RANDOM_RECORD, renderRecord(output, randomProbes, reasons)],
    [OPERATOR_RECORD, operatorRecord],
    [CORPUS_RECORD, corpusRecord],
  ];
  const summary = `${PROBES.length} probes, ${RANDOM_PROGRAMS.length} random programs, ${KNOWN_DIFFERENCE_CASES.length} known-difference cases, ${OPERATOR_CASES.length} operator cases, ${CORPUS.length} corpus shaders`;
  const options = { tool: 'godot-probes', summary };
  if (process.argv.includes('--check')) checkGenerated(outputs, { ...options, command: 'pnpm godot:probes' });
  else writeGenerated(outputs, options);
}

// `pathToFileURL`, not a `file://` template: on Windows `process.argv[1]` is a `C:\...` path.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
