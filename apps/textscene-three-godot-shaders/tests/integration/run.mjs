#!/usr/bin/env node
/**
 * The integration layer of the shader package: `pnpm test:shaders:gpu`. Each probe's transpiled
 * function runs on a real GL context in the browser that measures against Godot, from the packed
 * tarball and three.js alone, and its result bits are compared with Godot's live answers. The
 * run fails without a live run of `pnpm godot:probes`, when a transpiled row has no answer or a
 * probe of it fails, and it prints the count of transpiled instructions.
 */

import { join } from 'node:path';
import { INSTRUCTION_TABLE } from '../../../../packages/textscene-core/src/shaders/language/instructionTable.generated.ts';
import { withConsumerPage, writeJobSummary } from '../consumer.mjs';
import { godotAnswers } from '../godotAnswers.mjs';
import { PROBES } from '../probes/probes.mjs';
import { KNOWN_DIFFERENCE_CASES } from '../random/knownDifferences.mjs';
import { RANDOM_PROGRAMS } from '../random/randomSet.mjs';
import { compareProbe, coverageFailures, isFloatResult } from './compare.mjs';
import { runOnPage } from './pageRun.mjs';
import {
  compareKnownCases,
  compareRandomPrograms,
  knownCaseSummary,
  newDifferences,
  randomSummary,
  settledKnownCases,
  staleKnownPrograms,
} from './randomPrograms.mjs';

const ANSWERS = godotAnswers();
if (!ANSWERS.live) {
  throw new Error(
    "expected Godot's live answers, found the smoke subset only: run `pnpm godot:probes` first"
  );
}
const RECORD = ANSWERS.probes;
const RANDOM_RECORD = ANSWERS.random;

function verdictTable(verdicts) {
  const lines = PROBES.map((probe) => {
    const verdict = verdicts.get(probe.name);
    const result = verdict.passed ? 'equal' : `FAILS: ${verdict.detail}`;
    const ulp = verdict.mismatches === 0 ? '0' : String(verdict.maxUlp);
    return `| \`${probe.name}\` | ${verdict.lanes} | ${verdict.mismatches} | ${ulp} | ${result} |`;
  });
  return [
    '| Probe | Lanes | Lanes off | Max ULP | Against Godot |',
    '| --- | --- | --- | --- | --- |',
    ...lines,
  ].join('\n');
}

async function probeVerdicts(page) {
  const results = new Map();
  for (const probe of PROBES) {
    const actual = await runOnPage(page, probe);
    results.set(probe.name, compareProbe(RECORD.probes[probe.name], actual, isFloatResult(probe)));
  }
  return results;
}

async function main() {
  const { verdicts, random, known } = await withConsumerPage(
    { pageDir: join(import.meta.dirname, 'page'), module: 'probePage.js', harness: 'shaderProbes' },
    async (page) => ({
      verdicts: await probeVerdicts(page),
      random: await compareRandomPrograms(page, RANDOM_PROGRAMS, RANDOM_RECORD.probes),
      known: await compareKnownCases(page, KNOWN_DIFFERENCE_CASES, RANDOM_RECORD.probes),
    })
  );
  const transpiled = new Set(PROBES.flatMap((probe) => probe.rows));
  const failures = coverageFailures(PROBES, verdicts);
  const count = `${transpiled.size} of ${INSTRUCTION_TABLE.length} instructions transpiled`;
  const table = verdictTable(verdicts);
  console.log(table);
  console.log(
    `[shader-probes] ${count}, ${PROBES.length} probes against Godot ${RECORD.godot} on ${RECORD.adapter}`
  );
  const randomLine = `${randomSummary(random)} ${knownCaseSummary(known)}`;
  console.log(`[shader-random] ${randomLine}`);
  writeJobSummary(`## Shader probes against Godot\n\n${count}.\n\n${randomLine}\n\n${table}\n`);
  const allFailures = [
    ...failures,
    ...newDifferences(random),
    ...staleKnownPrograms(random),
    ...settledKnownCases(known),
  ];
  for (const failure of allFailures) console.error(`[shader-probes] ${failure}`);
  process.exitCode = allFailures.length === 0 ? 0 : 1;
}

await main();
