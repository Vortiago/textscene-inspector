#!/usr/bin/env node
/**
 * A longer run of random programs with a fresh seed, for a developer:
 * `pnpm test:shaders:random [--seed <n>] [--count <n>] [--functions <n>]`. It asks a live Godot for its answers,
 * so it needs Godot and xvfb as `pnpm godot:probes` does, and prints each program that differs,
 * reduced, with its seed. No pipeline runs it: the fixed-seed set guards each pull request.
 */

import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { runProbesInGodot } from '../../../../scripts/godot-probes/godotProject.mjs';
import { recordEntry } from '../../../../scripts/godot-probes/record.mjs';
import { withConsumerPage } from '../consumer.mjs';
import { compareRandomPrograms, newDifferences, randomSummary } from '../integration/randomPrograms.mjs';
import { generateFunctionPrograms } from './functionPrograms.mjs';
import { generatePrograms } from './programs.mjs';

const { values } = parseArgs({
  options: {
    seed: { type: 'string', default: String(Math.floor(Math.random() * 2 ** 31)) },
    count: { type: 'string', default: '1000' },
    functions: { type: 'string', default: '250' },
  },
});
const seed = Number(values.seed);
const programs = [
  ...generatePrograms({ seed, count: Number(values.count) }),
  ...generateFunctionPrograms({ seed, count: Number(values.functions) }),
];
const { pixels } = await runProbesInGodot(programs);
const entries = Object.fromEntries(
  programs.map((program) => [program.name, recordEntry(program, pixels.get(program.name))])
);
const results = await withConsumerPage(
  {
    pageDir: join(import.meta.dirname, '../integration/page'),
    module: 'probePage.js',
    harness: 'shaderProbes',
  },
  (page) => compareRandomPrograms(page, programs, entries)
);
console.log(`[shader-random] seed ${seed}: ${randomSummary(results)}`);
const failures = newDifferences(results);
for (const failure of failures) console.error(`[shader-random] ${failure}`);
process.exitCode = failures.length === 0 ? 0 : 1;
