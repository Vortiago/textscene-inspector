#!/usr/bin/env node
/**
 * The pre-push hook: runs the checks `planChecks` picks for the pushed commits. Git writes
 * one line per pushed ref on stdin: `<local ref> <local sha> <remote ref> <remote sha>`.
 * `FULL_VALIDATE=1 git push` runs the full `pnpm validate` instead, tests and packaging included.
 */

import { readFileSync } from 'node:fs';
import process from 'node:process';
import { git, planForFiles } from './changes.mjs';
import { pushedRanges } from './pushedRanges.mjs';
import { runChecks } from './runChecks.mjs';

if (process.env.FULL_VALIDATE === '1') {
  process.exitCode = runChecks('pre-push', [['pnpm', 'validate']]);
} else {
  const plan = planForFiles(pushedRanges(readFileSync(0, 'utf8'), git));
  process.exitCode = runChecks('pre-push', plan, 'pnpm check');
}
