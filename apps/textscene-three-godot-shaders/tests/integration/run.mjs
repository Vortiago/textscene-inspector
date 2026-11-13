#!/usr/bin/env node
/**
 * The integration layer of the shader package: `pnpm test:shaders:gpu`. Each probe's transpiled
 * function runs on a real GL context in the browser that measures against Godot, from the packed
 * tarball and three.js alone, and its result bits are compared with Godot's record. The run
 * fails when a transpiled row has no record or a probe of it fails, and it prints the count of
 * transpiled instructions.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INSTRUCTION_TABLE } from '../../../../packages/textscene-core/src/shaders/language/instructionTable.generated.ts';
import { PROBE_TYPES, parameterBits, probeSignature } from '../../../../scripts/godot-probes/probeShader.mjs';
import { withConsumerPage, writeJobSummary } from '../consumer.mjs';
import { PROBES } from '../probes/probes.mjs';
import { compareProbe, coverageFailures } from './compare.mjs';

const RECORD = JSON.parse(readFileSync(join(import.meta.dirname, '../probes/godot-record.json'), 'utf8'));

/** What the page needs of a probe: its source, its row count and its parameters' bits. */
function pageSpec(probe) {
  return { source: probe.source, rows: probe.inputs.length, parameters: parameterBits(probe) };
}

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

async function main() {
  const verdicts = await withConsumerPage(
    { pageDir: join(import.meta.dirname, 'page'), module: 'probePage.js', harness: 'shaderProbes' },
    async (page) => {
      const results = new Map();
      for (const probe of PROBES) {
        const actual = await page.evaluate((spec) => globalThis.runProbe(spec), pageSpec(probe));
        const isFloatResult = PROBE_TYPES[probeSignature(probe.source).returns].scalar === 'float';
        results.set(probe.name, compareProbe(RECORD.probes[probe.name], actual, isFloatResult));
      }
      return results;
    }
  );
  const transpiled = new Set(PROBES.flatMap((probe) => probe.rows));
  const failures = coverageFailures(PROBES, verdicts);
  const count = `${transpiled.size} of ${INSTRUCTION_TABLE.length} instructions transpiled`;
  const table = verdictTable(verdicts);
  console.log(table);
  console.log(
    `[shader-probes] ${count}, ${PROBES.length} probes against Godot ${RECORD.godot} on ${RECORD.adapter}`
  );
  writeJobSummary(`## Shader probes against Godot\n\n${count}.\n\n${table}\n`);
  for (const failure of failures) console.error(`[shader-probes] ${failure}`);
  process.exitCode = failures.length === 0 ? 0 : 1;
}

await main();
