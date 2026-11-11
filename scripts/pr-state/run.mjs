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
import { EXEMPTION_TABLES, prStateReport } from './prState.mjs';

/** A pull request into a feature branch passes that branch as `--base`. */
const DEFAULT_BASE = 'origin/main';

/** The draft and merge state of pull request `number`, read through the `gh` CLI. */
function readPullRequest(number) {
  const endpoint = `repos/{owner}/{repo}/pulls/${number}`;
  let json;
  try {
    json = execFileSync('gh', ['api', endpoint], { encoding: 'utf8' });
  } catch (error) {
    throw new Error(`read pull request ${number} with \`gh api ${endpoint}\`: ${error.message}`, {
      cause: error,
    });
  }
  const { draft, mergeable_state: mergeableState, head } = JSON.parse(json);
  return { number, draft, mergeableState, headSha: head.sha };
}

/** A table that moved would leave its edits out of the report with no sign, so a missing one stops the run. */
function assertExemptionTablesExist() {
  for (const path of EXEMPTION_TABLES.keys()) {
    if (!existsSync(resolve(REPO_ROOT, path))) {
      throw new Error(`expected the exemption table ${path}, found no such file: update EXEMPTION_TABLES`);
    }
  }
}

/** The committed change only, so every section describes the head commit the report names. */
function readBranchChange(baseRef, pullNumber) {
  const headSha = git('rev-parse', 'HEAD');
  const baseSha = git('merge-base', headSha, baseRef);
  return {
    head: { sha: headSha, branch: git('rev-parse', '--abbrev-ref', 'HEAD') },
    base: { ref: baseRef, sha: baseSha },
    nameStatus: git('diff', '--name-status', '--no-renames', baseSha, headSha),
    diff: git('diff', '-U0', baseSha, headSha),
    unkeptTestOnlyExports: coreTestOnlyExports().filter((id) => !KEPT_TEST_ONLY_EXPORTS.includes(id)),
    pullRequest: pullNumber === undefined ? undefined : readPullRequest(Number(pullNumber)),
  };
}

assertExemptionTablesExist();
const { values } = parseArgs({
  options: { base: { type: 'string', default: DEFAULT_BASE }, pr: { type: 'string' } },
});
process.stdout.write(prStateReport(readBranchChange(values.base, values.pr)));
