#!/usr/bin/env node
/**
 * `pnpm scope:issues [<number>...]`: prints each scope cut with no owner in the open issues, or in
 * the issues named, and fails when it finds one. A person or an agent runs it by hand, before a
 * plan goes to its owner.
 */

import process from 'node:process';
import { issueScopeCutsReport, unownedCutsOfIssues } from './issueScopeCuts.mjs';
import { readIssue, readOpenIssues } from './readIssues.mjs';
import { UNOWNED_CUT_HINT } from './scopeCuts.mjs';

const numbers = process.argv.slice(2);
const issues = numbers.length === 0 ? readOpenIssues() : numbers.flatMap(readIssue);
process.stdout.write(issueScopeCutsReport(issues));
if (unownedCutsOfIssues(issues).length > 0) {
  console.error(UNOWNED_CUT_HINT);
  process.exitCode = 1;
}
