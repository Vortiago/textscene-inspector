#!/usr/bin/env node
/**
 * Scaffolds a node-type vertical slice and wires its imports into the three aggregation files, so
 * a new node type edits no central file by hand. `--tier [--rule]` scaffolds the validator set of
 * an abstract class instead. The conformance guards (barrelCompleteness, reactFree,
 * webExtensionSafe, ruleCoverage) fail the suite on a mis-wired slice.
 *
 * @example
 *   pnpm new:node <TypeName> <category-dir> --intent <draws|transform-only|pending> [options]
 *   pnpm new:node RayCast3D physics/3d --intent transform-only --linter
 *   pnpm new:node ProgressBar 2d/ui --base control --intent pending --linter
 *   pnpm new:node Decal 3d --intent draws --linter
 */

import { parseArgs } from './new-node-slice/cli.mjs';
import { scaffoldSlice } from './new-node-slice/slice.mjs';
import { scaffoldTier } from './new-node-slice/tier.mjs';

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.tier) return scaffoldTier(args);
  scaffoldSlice(args);
}

main();
