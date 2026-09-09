/** The argument contract, and which fixtures a run covers. */

import { existsSync, readFileSync } from 'node:fs';
import { PLAN } from './paths.mjs';

export function parseArgs(argv) {
  const args = { godot: false, ours: false, only: null, force: false };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--godot':
        args.godot = true;
        break;
      case '--ours':
        args.ours = true;
        break;
      case '--force':
        args.force = true;
        break;
      case '--only':
        args.only = argv[++i];
        break;
      default:
        throw new Error(`Unknown flag ${argv[i]}`);
    }
  }
  if (!args.godot && !args.ours) {
    args.godot = true;
    args.ours = true;
  }
  return args;
}

export function loadPlan(only) {
  if (!existsSync(PLAN)) {
    throw new Error(`No capture plan at ${PLAN} — generate it before capturing.`);
  }
  const plan = JSON.parse(readFileSync(PLAN, 'utf8'));
  const fixtures = only ? plan.distinct.filter((f) => f.includes(only)) : plan.distinct;
  if (fixtures.length === 0) throw new Error(`No fixture matches --only ${only}`);
  return fixtures;
}
