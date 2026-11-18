#!/usr/bin/env node
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

/** `--shard <index>/<count>`, a shard of equal seconds as CI runs it, else null for every scenario. */
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
  scenarios.forEach((scenario, index) => checkScenario(gate, scenario, results[index]));
  logMeasurements(scenarios, results);

  if (!gate.ok) {
    console.error('\n[gate] FAILED');
    for (const failure of gate.failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log('\n[gate] PASSED');
}

/** Runs each scenario in order, and answers what each measured or the error that stopped it. */
async function runScenarios(scenarios, browser, baseUrl) {
  const results = [];
  for (const scenario of scenarios) {
    console.log(`[gate] ${scenario.title}`);
    try {
      results.push({ measured: await scenario.run(browser, baseUrl) });
    } catch (error) {
      // One scenario that throws still leaves the claims of the others in the shard to report.
      console.error(error);
      results.push({ error });
    }
  }
  return results;
}

function checkScenario(gate, scenario, { measured, error }) {
  if (error) gate.check(false, `[${scenario.name}] did not finish: ${error.message ?? error}`);
  else scenario.check(gate, measured);
}

/** Prints what each scenario measured, pass or fail, for a run's log. */
function logMeasurements(scenarios, results) {
  console.log('\n[gate] measurements');
  scenarios.forEach(({ measure }, index) => {
    const { measured } = results[index];
    if (measure && measured) console.log(`  ${measure(measured)}`);
  });
}

await main();
