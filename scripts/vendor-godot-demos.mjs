#!/usr/bin/env node
/**
 * Vendors the godot-demo-projects corpora into scenes/demos/ and scenes/isometric/, unless they
 * already hold the current recipe's output. `pnpm install` runs it, and so do the unit tests and
 * the fixture scripts, so a checkout that moves to a new pin or patch fetches again.
 *
 * @example
 *   pnpm vendor:demos
 *   node scripts/vendor-godot-demos.mjs --key   # prints the recipe key, which CI caches by
 */

import { ensureGodotDemos, recipeKey } from './vendor-godot-demos/vendor.mjs';

const args = process.argv.slice(2);
try {
  if (args.length === 1 && args[0] === '--key') console.log(recipeKey());
  else if (args.length === 0) ensureGodotDemos();
  else throw new Error(`expected no argument or --key, got ${args.join(' ')}`);
} catch (e) {
  console.error(`[vendor-godot-demos] ${e.message}`);
  process.exitCode = 1;
}
