#!/usr/bin/env node
/**
 * `pnpm scope:issues [<number>...]`: prints each scope cut with no owner in the open issues, or in
 * the issues named. It reads GitHub through the `gh` CLI and fails when it finds a cut. A person or
 * an agent runs it by hand, before a plan goes to its owner.
 */

import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { issueScopeCutsReport, parseIssues, unownedCutsOfIssues } from './issueScopeCuts.mjs';

/** The 357 open issues of November 2026 take 2 MB, which is over the 1 MB default of a child process. */
const MAX_ANSWER_BYTES = 64 * 1024 * 1024;

/** GitHub's answer to `gh api <args>`. */
function readGitHub(...args) {
  try {
    return execFileSync('gh', ['api', ...args], { encoding: 'utf8', maxBuffer: MAX_ANSWER_BYTES });
  } catch (error) {
    throw new Error(`read GitHub with \`gh api ${args.join(' ')}\`: ${error.message}`, { cause: error });
  }
}

/** GitHub's largest page. */
const ISSUES_PER_PAGE = 100;

/**
 * Page by page, not with `--paginate`: that follows GitHub's `Link` header, whose numeric repository
 * path a proxy in front of GitHub can refuse.
 */
function readOpenIssues() {
  const issues = [];
  for (let page = 1; ; page += 1) {
    const json = readGitHub(
      `repos/{owner}/{repo}/issues?state=open&per_page=${ISSUES_PER_PAGE}&page=${page}`
    );
    if (json.trim() === '[]') return issues;
    issues.push(...parseIssues(json));
  }
}

function readIssue(number) {
  if (!/^\d+$/.test(number)) throw new Error(`expected an issue number, got "${number}"`);
  return parseIssues(readGitHub(`repos/{owner}/{repo}/issues/${number}`));
}

const numbers = process.argv.slice(2);
const issues = numbers.length === 0 ? readOpenIssues() : numbers.flatMap(readIssue);
process.stdout.write(issueScopeCutsReport(issues));
if (unownedCutsOfIssues(issues).length > 0) {
  console.error(
    'A scope cut has no owner: write an issue number, or "no issue:" with the reason, in its line.'
  );
  process.exitCode = 1;
}
