/**
 * Reads issues from GitHub for the scope cut rule. `issueScopeCuts.mjs` parses what this reads.
 */

import { readGitHub } from '../readGitHub.mjs';
import { parseIssues } from './issueScopeCuts.mjs';

/** GitHub's largest page. */
const ISSUES_PER_PAGE = 100;

/**
 * The issue with `number`, or nothing when the number names a pull request.
 *
 * @param {number | string} number
 */
export function readIssue(number) {
  if (!/^\d+$/.test(String(number))) throw new Error(`expected an issue number, got "${number}"`);
  return parseIssues(readGitHub(`repos/{owner}/{repo}/issues/${number}`));
}

/**
 * Every open issue. Page by page, not with `--paginate`: that follows GitHub's `Link` header, whose
 * numeric repository path a proxy in front of GitHub can refuse.
 */
export function readOpenIssues() {
  const issues = [];
  for (let page = 1; ; page += 1) {
    const json = readGitHub(
      `repos/{owner}/{repo}/issues?state=open&per_page=${ISSUES_PER_PAGE}&page=${page}`
    );
    if (json.trim() === '[]') return issues;
    issues.push(...parseIssues(json));
  }
}
