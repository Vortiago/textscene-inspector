/**
 * Record a showcase clip by scenario name (see scenarios.mjs):
 *   node scripts/showcase/run.mjs <scenario-name>
 *   node scripts/showcase/run.mjs all          # record every scenario
 *
 * Requires the preview server running at SHOWCASE_URL (default :4173).
 */
import { recordShowcase } from './record.mjs';
import { scenarios } from './scenarios.mjs';

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
  await recordShowcase(name, scenario.run);
}
