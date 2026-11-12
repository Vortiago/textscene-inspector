/**
 * The report of a branch's state that `pnpm pr:state` prints, for a thread to paste into its
 * report of a pull request: the head, the changed baselines and scenes, the added lines that defer
 * work, the exemption tables it edits and the exports only tests import. It reads git's text only.
 */

import { changedEntries } from '../gitNameStatus.mjs';
import { goldenNameOf } from '../visual/baselinePath.mjs';

/** A line that puts work off or switches a test off: a reviewer asks for the reason of each. */
const DEFERS_WORK = /\b(TODO|FIXME|HACK)\b|\b(it|test|describe)\.(skip|todo|only)\b/;

/** A comment that names a fallback. Code is left out: core uses the word in over 500 lines of it. */
const FALLBACK_COMMENT = /(\/\/|\/\*|^\s*\*|#\s|<!--).*\bfallback\b/i;

/** A line that records a gap of a feature, in the words the comparison sheets use. */
const RECORDS_LIMIT = /known limitation|approximated|not supported|unsupported/i;

/** The words that record a gap only in a document. Code and its comments use them for other things. */
const RECORDS_LIMIT_IN_DOCUMENT = /\bfallback\b|\bstays in\b/i;

const FLAGS = [DEFERS_WORK, FALLBACK_COMMENT, RECORDS_LIMIT];

function isFlagged({ path, text }) {
  return (
    FLAGS.some((flag) => flag.test(text)) || (path.endsWith('.md') && RECORDS_LIMIT_IN_DOCUMENT.test(text))
  );
}

/** The files that hold a table of exemptions from a gate, each with what its table exempts. */
export const EXEMPTION_TABLES = new Map([
  ['packages/textscene-core/src/linter/fixtureLint.test.ts', 'the advisories a unit fixture may report'],
  ['scripts/testOnlyExports.core.mjs', 'the exports kept although only tests import them'],
  ['scripts/ci/visualScope.mjs', 'the files a change may touch with no visual run'],
  ['eslint.config.js', 'the lint rules and the files they skip'],
  ['scripts/vendor-prune.mjs', 'the importers whose sidecars the previewer reads'],
  ['scripts/import-sidecar-allowlist.test.mjs', 'the import parameters a vendored sidecar may set'],
  ['scripts/resourceLookups.test.mjs', 'the readers not moved onto resources/reading yet'],
]);

/**
 * @typedef {object} BranchChange
 * @property {{ sha: string, branch: string }} head
 * @property {{ ref: string, sha: string }} base - the ref the branch left, and the commit where it left.
 * @property {string} nameStatus - `git diff --name-status --no-renames <base.sha> <head.sha>` output.
 * @property {string} diff - `git diff -U0 <base.sha> <head.sha>` output, uncoloured, with the `a/` and `b/` prefixes.
 * @property {boolean} [hasUncommittedChanges] - whether the working tree differs from the head.
 * @property {string[]} unkeptTestOnlyExports - each `file#name` only tests import, the kept ones left out.
 * @property {{ number: number, draft: boolean, mergeableState: string, headSha: string }} [pullRequest]
 */

/** The draft state, the merge state and the head of a pull request, from GitHub's JSON for it. */
export function parsePullRequest(json) {
  const { number, draft, mergeable_state: mergeableState, head } = JSON.parse(json);
  return { number, draft, mergeableState, headSha: head.sha };
}

/**
 * @param {BranchChange} change
 * @returns {string} the report, as Markdown.
 */
export function prStateReport(change) {
  const files = changedEntries(change.nameStatus);
  return [
    '# Pull request state',
    '',
    ...headLines(change),
    '',
    section('Baselines', files.flatMap(baselineEntry)),
    section('Scenes and resources', files.filter(isSceneOrResource).map(fileEntry)),
    section('Added lines that defer work or record a limit', flaggedLines(change.diff)),
    section('Exemption tables edited', files.flatMap(exemptionEntry)),
    section(
      'Test-only exports',
      change.unkeptTestOnlyExports.map((id) => `\`${id}\``)
    ),
  ].join('\n');
}

function headLines({ head, base, pullRequest, hasUncommittedChanges }) {
  const lines = [
    `- Head: \`${head.sha}\` on \`${head.branch}\``,
    `- Base: \`${base.ref}\` at \`${base.sha}\``,
  ];
  if (pullRequest) lines.push(pullRequestLine(pullRequest, head.sha));
  if (hasUncommittedChanges) lines.push(UNCOMMITTED_CHANGES_LINE);
  return lines;
}

/** The export scan reads the files on disk, so only a clean working tree makes it describe the head. */
const UNCOMMITTED_CHANGES_LINE =
  '- The working tree has uncommitted changes. The test-only exports describe it, not the head. Commit or stash first.';

/** A pull request behind or ahead of the local head makes every section below describe another commit. */
function pullRequestLine({ number, draft, mergeableState, headSha }, localSha) {
  const state = `- Pull request #${number}: ${draft ? 'draft' : 'ready'}, mergeable state \`${mergeableState}\``;
  return headSha === localSha
    ? state
    : `${state}. Its head is \`${headSha}\`, not the local head. Push or pull first.`;
}

/** A titled list with its count, or "None." so an empty section reads as checked, not as missing. */
function section(title, entries) {
  const body = entries.length === 0 ? 'None.' : entries.map((entry) => `- ${entry}`).join('\n');
  return `## ${title} (${entries.length})\n\n${body}\n`;
}

function baselineEntry({ change, path }) {
  const golden = goldenNameOf(path);
  return golden ? [`${change} \`${golden}\``] : [];
}

function isSceneOrResource({ path }) {
  return path.endsWith('.tscn') || path.endsWith('.tres');
}

function fileEntry({ change, path }) {
  return `${change} \`${path}\``;
}

function exemptionEntry({ path }) {
  const exempts = EXEMPTION_TABLES.get(path);
  return exempts ? [`\`${path}\`: ${exempts}`] : [];
}

function flaggedLines(diff) {
  return addedLines(diff)
    .filter(isFlagged)
    .map(({ path, line, text }) => `\`${path}:${line}\` ${text.trim()}`);
}

/** A hunk header, `@@ -a,b +c,d @@`: the removed count, the first new line and the added count. */
const HUNK_HEADER = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/** Git leaves a count of 1 out of a hunk header. */
const countOf = (digits) => (digits === undefined ? 1 : Number(digits));

/**
 * Each line a unified diff adds, with its path and its line number in the new file. The counts of a
 * hunk header bound its body, so an added line that starts with `++ ` does not read as a file header.
 */
function addedLines(diff) {
  const added = [];
  let path = '';
  let line = 0;
  let oldLeft = 0;
  let newLeft = 0;
  for (const text of diff.split('\n')) {
    if (oldLeft + newLeft === 0) {
      const hunk = HUNK_HEADER.exec(text);
      if (hunk) {
        oldLeft = countOf(hunk[1]);
        line = Number(hunk[2]);
        newLeft = countOf(hunk[3]);
      } else if (text.startsWith('+++ ')) {
        path = text.slice('+++ b/'.length);
      }
      continue;
    }
    const sign = text[0];
    if (sign === '+') added.push({ path, line, text: text.slice(1) });
    if (sign === '-' || sign === ' ') oldLeft -= 1;
    if (sign === '+' || sign === ' ') {
      newLeft -= 1;
      line += 1;
    }
  }
  return added;
}
