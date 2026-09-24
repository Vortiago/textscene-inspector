/**
 * Records a showcase clip by scenario name (scenarios.mjs), or every clip with `all`. It opens the
 * app on each scenario's fixture (?fixture=<file>) and needs the preview server at SHOWCASE_URL
 * (default :4173).
 *
 * @example
 *   node scripts/showcase/run.mjs <scenario-name>
 *   node scripts/showcase/run.mjs all
 */
import { readFixtureManifest } from '../fixtureManifest.mjs';
import { recordShowcase } from './record.mjs';
import { scenarios } from './scenarios.mjs';

// The label-to-file map of the generated fixtures manifest.
const FIXTURES = readFixtureManifest();
const fileForLabel = (label) => FIXTURES.find((f) => f.name === label)?.file;

const arg = process.argv[2];
if (!arg) {
  console.error('usage: node scripts/showcase/run.mjs <name|all>');
  console.error('available:', Object.keys(scenarios).join(', '));
  process.exit(1);
}

const names = arg === 'all' ? Object.keys(scenarios) : [arg];
for (const name of names) {
  const scenario = scenarios[name];
  if (!scenario) {
    console.error(`unknown scenario "${name}". available: ${Object.keys(scenarios).join(', ')}`);
    process.exitCode = 1;
    continue;
  }
  const file = fileForLabel(scenario.label);
  if (!file) {
    console.error(`no fixture file for label "${scenario.label}" (scenario ${name})`);
    process.exitCode = 1;
    continue;
  }
  await recordShowcase(name, file, scenario.run);
}
