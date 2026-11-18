#!/usr/bin/env node
/**
 * @example
 *   pnpm test:e2e:web                 # every scenario
 *   pnpm test:e2e:web --shard 1/2     # the 1st of 2 shards of equal seconds, as CI runs it
 */
import { previewPort, withPreviewBrowser } from '../visual/previewServer.mjs';
import { parseShard } from '../shards/shards.mjs';
import { scenariosOf } from './gateScenarios.mjs';

class GateFailures {
  constructor() {
    this.failures = [];
  }
  check(condition, message) {
    if (!condition) this.failures.push(message);
  }
  get ok() {
    return this.failures.length === 0;
  }
}

/** `--shard <index>/<count>`, or null for every scenario. Anything else is a usage error (exit 2). */
function parseArgs(argv) {
  if (argv.length === 0) return null;
  const shard = argv[0] === '--shard' && argv.length === 2 ? parseShard(argv[1]) : null;
  if (!shard) {
    const hint = argv[0] === '--' ? '. Drop the "--": pnpm passes it to the script' : '';
    console.error(`[gate] expected no argument or --shard <index>/<count>, got "${argv.join(' ')}"${hint}`);
    process.exit(2);
  }
  return shard;
}

/** The scenarios to run. A shard with none is a usage error (exit 2), since an empty run passes. */
function selectScenarios(shard) {
  const scenarios = scenariosOf(shard);
  if (scenarios.length === 0) {
    console.error(`[gate] expected a shard with scenarios, got none in ${shard.index}/${shard.count}`);
    process.exit(2);
  }
  return scenarios;
}

async function main() {
  const scenarios = selectScenarios(parseArgs(process.argv.slice(2)));
  const results = await withPreviewBrowser(previewPort('e2eWeb'), (browser, baseUrl) =>
    runScenarios(scenarios, browser, baseUrl)
  );
  const gate = new GateFailures();
  scenarios.forEach((scenario, index) => scenario.check(gate, results[index]));
  logMeasurements(scenarios, results);

  if (!gate.ok) {
    console.error('\n[gate] FAILED');
    for (const failure of gate.failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log('\n[gate] PASSED');
}

/** Runs each scenario in order, and answers what each measured. */
async function runScenarios(scenarios, browser, baseUrl) {
  const results = [];
  for (const scenario of scenarios) {
    console.log(`[gate] ${scenario.title}`);
    results.push(await scenario.run(browser, baseUrl));
  }
  return results;
}

/** Prints what each scenario measured, pass or fail, for a run's log. */
function logMeasurements(scenarios, results) {
  console.log('\n[gate] measurements');
  scenarios.forEach(({ measure }, index) => {
    if (measure) console.log(`  ${measure(results[index])}`);
  });
}

await main();
