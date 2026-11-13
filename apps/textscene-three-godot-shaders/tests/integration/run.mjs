#!/usr/bin/env node
/**
 * The integration layer of the shader package: `pnpm test:shaders:gpu`. Each probe's translated
 * function runs on a real GL context in the browser that measures against Godot, from the packed
 * tarball and three.js alone, and its result bits are compared with Godot's record. The run
 * fails when a translated row has no record or a probe of it fails, and it prints the count of
 * translated instructions.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INSTRUCTION_TABLE } from '../../../../packages/textscene-core/src/shaders/language/instructionTable.generated.ts';
import { withConsumerPage, writeJobSummary } from '../consumer.mjs';
import { PROBES } from '../probes/probes.mjs';
import { RANDOM_PROGRAMS } from '../random/randomSet.mjs';
import { compareProbe, coverageFailures } from './compare.mjs';
import { runOnPage } from './pageRun.mjs';
import { compareRandomPrograms, randomFailures, randomSummary } from './randomPrograms.mjs';

const readRecord = (path) => JSON.parse(readFileSync(join(import.meta.dirname, path), 'utf8'));
const RECORD = readRecord('../probes/godot-record.json');
const RANDOM_RECORD = readRecord('../random/godot-record.json');

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
    results.set(probe.name, compareProbe(RECORD.probes[probe.name], await runOnPage(page, probe)));
  }
  return results;
}

async function main() {
  const { verdicts, random } = await withConsumerPage(
    { pageDir: join(import.meta.dirname, 'page'), module: 'probePage.js', harness: 'shaderProbes' },
    async (page) => ({
      verdicts: await probeVerdicts(page),
      random: await compareRandomPrograms(page, RANDOM_PROGRAMS, RANDOM_RECORD.probes),
    })
  );
  const translated = new Set(PROBES.flatMap((probe) => probe.rows));
  const failures = coverageFailures(PROBES, verdicts);
  const count = `${translated.size} of ${INSTRUCTION_TABLE.length} instructions translated`;
  const table = verdictTable(verdicts);
  console.log(table);
  console.log(
    `[shader-probes] ${count}, ${PROBES.length} probes against Godot ${RECORD.godot} on ${RECORD.adapter}`
  );
  const randomLine = randomSummary(random);
  console.log(`[shader-random] ${randomLine}`);
  writeJobSummary(`## Shader probes against Godot\n\n${count}.\n\n${randomLine}\n\n${table}\n`);
  const allFailures = [...failures, ...randomFailures(random)];
  for (const failure of allFailures) console.error(`[shader-probes] ${failure}`);
  process.exitCode = allFailures.length === 0 ? 0 : 1;
}

await main();
