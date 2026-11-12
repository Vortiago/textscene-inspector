#!/usr/bin/env node
/**
 * `pnpm pr:state [--base <ref>] [--pr <number>]`: prints the state of the checked-out branch for a
 * report of its pull request. It reads git, the test-only export scan and, with `--pr`, GitHub.
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { git } from '../githooks/changes.mjs';
import { REPO_ROOT } from '../repoRoot.mjs';
import { coreTestOnlyExports, KEPT_TEST_ONLY_EXPORTS } from '../testOnlyExports.core.mjs';
import { EXEMPTION_TABLES, parsePullRequest, prStateReport } from './prState.mjs';

/** A pull request into a feature branch passes that branch as `--base`. */
const DEFAULT_BASE = 'origin/main';

/** GitHub's JSON for pull request `number`, read through the `gh` CLI. */
function readPullRequest(number) {
  if (!/^\d+$/.test(number)) throw new Error(`expected a pull request number for --pr, got "${number}"`);
  const endpoint = `repos/{owner}/{repo}/pulls/${number}`;
  try {
    return execFileSync('gh', ['api', endpoint], { encoding: 'utf8' });
  } catch (error) {
    throw new Error(`read pull request ${number} with \`gh api ${endpoint}\`: ${error.message}`, {
      cause: error,
    });
  }
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
  options: { base: { type: 'string', default: DEFAULT_BASE }, pr: { type: 'string' } },
});
process.stdout.write(
  prStateReport({
    ...readBranchChange(values.base),
    unkeptTestOnlyExports: unkeptTestOnlyExports(),
    pullRequest: values.pr === undefined ? undefined : parsePullRequest(readPullRequest(values.pr)),
  })
);
