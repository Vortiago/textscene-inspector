/**
 * The fixed-seed set of random programs that `pnpm godot:probes` records and the "Shader
 * package" job compares on each pull request. A fresh seed is for `pnpm test:shaders:random`.
 */

import { generatePrograms } from './programs.mjs';

export const FIXED_SEED = 1847;

/**
 * The programs with random roots, beside one rooted at each transpiled row. The set runs in
 * one Godot run and one page run of about a second each, inside the job's budget.
 */
const RANDOM_ROOTS = 200;

export const RANDOM_PROGRAMS = generatePrograms({ seed: FIXED_SEED, count: RANDOM_ROOTS });
