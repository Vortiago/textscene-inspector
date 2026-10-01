#!/usr/bin/env node
/**
 * Turns the Claude review's structured output into what the workflow posts. Claude only reads
 * and answers, so it holds no GitHub tool: this script shapes its answer, and the workflow
 * posts it with the job's own token. CI passes the output on stdin and an argument that names
 * the form: `review` prints a pull request review as JSON, `comment` prints a plain comment.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** The heading of every summary. An earlier review is found by it, so it never changes. */
export const SUMMARY_HEADING = '## Claude review';

/** The severities in REVIEW.md, each with the circle a reader scans for. */
export const SEVERITY_MARKS = {
  important: '🔴 **Important**',
  nit: '🟡 **Nit**',
  preexisting: '🟣 **Pre-existing**',
};

/**
 * @typedef {{ path: string, line: number, severity: keyof typeof SEVERITY_MARKS, body: string }} Finding
 * @typedef {{ summary: string, findings?: Finding[] }} ReviewOutput
 */

/** @param {Finding} finding */
function markedBody(finding) {
  const mark = SEVERITY_MARKS[finding.severity];
  if (!mark)
    throw new Error(`expected a severity in ${Object.keys(SEVERITY_MARKS)}, got ${finding.severity}`);
  return `${mark}: ${finding.body}`;
}

/** @param {ReviewOutput} output */
function summaryBody(output) {
  return `${SUMMARY_HEADING}\n\n${output.summary}`;
}

/**
 * @param {ReviewOutput} output
 * @returns {{ event: 'COMMENT', body: string, comments: object[] }} the body of
 *   `POST /repos/{owner}/{repo}/pulls/{n}/reviews`, one inline comment for each finding.
 */
export function reviewPayload(output) {
  return {
    event: 'COMMENT',
    body: summaryBody(output),
    comments: (output.findings ?? []).map((finding) => ({
      path: finding.path,
      line: finding.line,
      side: 'RIGHT',
      body: markedBody(finding),
    })),
  };
}

/**
 * GitHub refuses a whole review when one comment names a line outside the diff, so the
 * workflow falls back to this: the summary with each finding listed under it.
 * @param {ReviewOutput} output
 * @returns {string} Markdown for one pull request comment.
 */
export function commentBody(output) {
  const findings = (output.findings ?? []).map(
    (finding) => `- \`${finding.path}:${finding.line}\` ${markedBody(finding)}`
  );
  return [summaryBody(output), ...(findings.length ? ['', ...findings] : [])].join('\n');
}

function main() {
  const form = process.argv[2];
  const output = JSON.parse(readFileSync(0, 'utf8'));
  if (form === 'review') process.stdout.write(JSON.stringify(reviewPayload(output)));
  else if (form === 'comment') process.stdout.write(commentBody(output));
  else throw new Error(`expected "review" or "comment", got ${form}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
