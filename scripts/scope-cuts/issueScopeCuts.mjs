/**
 * The scope cuts of issue bodies that name no owner, and the report `pnpm scope:issues` prints of
 * them. It reads text only: `issues.mjs` reads GitHub.
 */

import { unownedScopeCuts } from './scopeCuts.mjs';

/**
 * @typedef {object} Issue
 * @property {number} number
 * @property {string} title
 * @property {string} body
 */

/**
 * The issues of GitHub's JSON for one issue or for a page of the issue list. That list holds pull
 * requests too, which this leaves out.
 *
 * @returns {Issue[]}
 */
export function parseIssues(json) {
  return (
    [JSON.parse(json)]
      .flat()
      .filter((entry) => entry.pull_request === undefined)
      // GitHub gives null, not an empty string, for an issue with no body.
      .map(({ number, title, body }) => ({ number, title, body: body ?? '' }))
  );
}

/**
 * Each issue that holds a scope cut with no owner, with those cuts.
 *
 * @param {Issue[]} issues
 */
export function unownedCutsOfIssues(issues) {
  return issues
    .map(({ number, title, body }) => ({ number, title, cuts: unownedScopeCuts(body) }))
    .filter(({ cuts }) => cuts.length > 0);
}

const issueSection = ({ number, title, cuts }) =>
  [
    `## #${number} ${title} (${cuts.length})`,
    '',
    ...cuts.map(({ line, text }) => `- \`${line}\` ${text}`),
    '',
  ].join('\n');

/**
 * @param {Issue[]} issues
 * @returns {string} the report, as Markdown.
 */
export function issueScopeCutsReport(issues) {
  const withCuts = unownedCutsOfIssues(issues);
  const count = `Issues that hold a scope cut with no owner: ${withCuts.length} of ${issues.length}.`;
  return ['# Scope cuts with no owner', '', count, '', ...withCuts.map(issueSection)].join('\n');
}
