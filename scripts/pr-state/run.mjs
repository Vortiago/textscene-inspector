#!/usr/bin/env node
/**
 * `pnpm pr:state [--base <ref>] [--pr <number>] [--out <file>]`: prints the state of the checked-out
 * branch for a report of its pull request, and with `--out` writes it to a file too. It reads git, the
 * test-only export scan and, with `--pr`, GitHub. It fails when the body of that pull request gives
 * an added limit line no owner.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { git } from '../githooks/changes.mjs';
import { REPO_ROOT } from '../repoRoot.mjs';
import { coreTestOnlyExports, KEPT_TEST_ONLY_EXPORTS } from '../testOnlyExports.core.mjs';
import {
  EXEMPTION_TABLES,
  parseCheckRuns,
  parsePullRequest,
  prStateReport,
  unownedLimitLines,
} from './prState.mjs';

/** A pull request into a feature branch passes that branch as `--base`. */
const DEFAULT_BASE = 'origin/main';

/** GitHub's answer to `gh api <args>`. */
function readGitHub(...args) {
  try {
    return execFileSync('gh', ['api', ...args], { encoding: 'utf8' });
  } catch (error) {
    throw new Error(`read GitHub with \`gh api ${args.join(' ')}\`: ${error.message}`, { cause: error });
  }
}

/** One `<name>\t<result>` line for each check: the conclusion, or the status of a check still in progress. */
const CHECK_RUN_LINES = '.check_runs[] | [.name, .conclusion // .status] | @tsv';

/** Pull request `number` with the checks of its head, read through the `gh` CLI. */
function readPullRequest(number) {
  if (!/^\d+$/.test(number)) throw new Error(`expected a pull request number for --pr, got "${number}"`);
  const pullRequest = parsePullRequest(readGitHub(`repos/{owner}/{repo}/pulls/${number}`));
  const checkRuns = `repos/{owner}/{repo}/commits/${pullRequest.headSha}/check-runs`;
  return {
    ...pullRequest,
    checks: parseCheckRuns(readGitHub(checkRuns, '--paginate', '--jq', CHECK_RUN_LINES)),
  };
}

function writeReport(report, file) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, report);
}

/** A table that moved would leave its edits out of the report with no sign, so a missing one stops the run. */
function assertExemptionTablesExist() {
  for (const path of EXEMPTION_TABLES.keys()) {
    if (!existsSync(resolve(REPO_ROOT, path))) {
      throw new Error(`expected the exemption table ${path}, found no such file: update EXEMPTION_TABLES`);
    }
  }
}

/** A user's git configuration can colour a diff, rename its prefixes or hand it to another program. */
const PLAIN_DIFF = ['--no-color', '--no-ext-diff', '--src-prefix=a/', '--dst-prefix=b/'];

/** The committed change, and whether the working tree has moved past the head commit the report names. */
function readBranchChange(baseRef) {
  const headSha = git('rev-parse', 'HEAD');
  const baseSha = git('merge-base', headSha, baseRef);
  return {
    head: { sha: headSha, branch: git('rev-parse', '--abbrev-ref', 'HEAD') },
    base: { ref: baseRef, sha: baseSha },
    nameStatus: git('diff', '--name-status', '--no-renames', baseSha, headSha),
    diff: git('diff', '-U0', ...PLAIN_DIFF, baseSha, headSha),
    hasUncommittedChanges: git('status', '--porcelain') !== '',
  };
}

function unkeptTestOnlyExports() {
  return coreTestOnlyExports().filter((id) => !KEPT_TEST_ONLY_EXPORTS.includes(id));
}

assertExemptionTablesExist();
const { values } = parseArgs({
  options: {
    base: { type: 'string', default: DEFAULT_BASE },
    pr: { type: 'string' },
    out: { type: 'string' },
  },
});
const change = {
  ...readBranchChange(values.base),
  unkeptTestOnlyExports: unkeptTestOnlyExports(),
  pullRequest: values.pr === undefined ? undefined : readPullRequest(values.pr),
};
const report = prStateReport(change);
process.stdout.write(report);
if (values.out !== undefined) writeReport(report, values.out);
if (change.pullRequest && unownedLimitLines(change).length > 0) {
  console.error('A limit line has no owner: name its file beside an issue number or "no issue" in the body.');
  process.exitCode = 1;
}
