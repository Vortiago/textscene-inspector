#!/usr/bin/env node
import { join } from 'node:path';
import { INSTRUCTION_TABLE } from '../../../../packages/textscene-core/src/shaders/language/instructionTable.generated.ts';
import { withConsumerPage, writeJobSummary } from '../consumer.mjs';
import { liveGodotAnswers } from '../godotAnswers.mjs';
import { KNOWN_PROBE_DIFFERENCES } from '../probes/knownProbeDifferences.mjs';
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

const ANSWERS = liveGodotAnswers();
const RECORD = ANSWERS.probes;
const RANDOM_RECORD = ANSWERS.random;

function verdictTable(verdicts) {
  const lines = PROBES.map((probe) => {
    const verdict = verdicts.get(probe.name);
    const known = KNOWN_PROBE_DIFFERENCES[probe.name];
    const listed = known && !verdict.passed ? `listed (${known.cause}): ${verdict.detail}` : undefined;
    const result = verdict.passed ? 'equal' : (listed ?? `FAILS: ${verdict.detail}`);
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
  const failures = coverageFailures(PROBES, verdicts, KNOWN_PROBE_DIFFERENCES);
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
