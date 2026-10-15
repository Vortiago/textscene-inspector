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

try {
  if (process.argv[2] === '--key') console.log(recipeKey());
  else ensureGodotDemos();
} catch (e) {
  console.error(`\n[vendor-godot-demos] ${e.message}`);
  process.exitCode = 1;
}
