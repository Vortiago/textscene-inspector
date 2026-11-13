/**
 * The report of a branch's state that `pnpm pr:state` prints, for a thread to paste into its
 * report of a pull request: the head, the changed baselines and scenes, the added lines that defer
 * work, the exemption tables it edits and the exports only tests import. For a pull request it adds
 * the checks of its head, the limit lines its body gives no owner and the scope cuts that name no
 * owner. It reads text only.
 */

import { changedEntries } from '../gitNameStatus.mjs';
import { unownedScopeCuts } from '../scope-cuts/scopeCuts.mjs';
import { goldenNameOf } from '../visual/baselinePath.mjs';

/** A line that puts work off or switches a test off: a reviewer asks for the reason of each. */
const DEFERS_WORK = /\b(TODO|FIXME|HACK)\b|\b(it|test|describe)\.(skip|todo|only)\b/;

/** The start of a comment in the languages of the repository, with the text that follows it. */
const COMMENT = /(?:\/\/|\/\*|^\s*\*|#\s|<!--)(.*)/;

const commentOf = (text) => COMMENT.exec(text)?.[1] ?? '';

/** A word that names a fallback. Only a comment counts: core uses the word in over 500 lines of code. */
const FALLBACK = /\bfallback\b/i;

/** A line that records a gap of a feature, in the words the comparison sheets use. */
const RECORDS_LIMIT = /known limitation|approximated|not supported|unsupported/i;

/** The words that record a gap only in a document. Code and its comments use them for other things. */
const RECORDS_LIMIT_IN_DOCUMENT = /\bfallback\b|\bstays in\b/i;

function recordsLimit({ path, text }) {
  return RECORDS_LIMIT.test(text) || (path.endsWith('.md') && RECORDS_LIMIT_IN_DOCUMENT.test(text));
}

function isFlagged(line) {
  return DEFERS_WORK.test(line.text) || FALLBACK.test(commentOf(line.text)) || recordsLimit(line);
}

/**
 * A limit line, as REVIEW.md has it: a line of a document or a comment that records a limit. It
 * needs an owner in the pull request body. Code that holds the same words needs none.
 */
function isLimitLine({ path, text }) {
  return path.endsWith('.md') ? recordsLimit({ path, text }) : RECORDS_LIMIT.test(commentOf(text));
}

/** An issue number, the link of an issue, or the words that say a limit line has no issue and why. */
const NAMES_OWNER = /#\d+|\/issues\/\d+|\bno issue\b/i;

/** The directory and the name of a file, which is how a body names a sheet: `textedit/comparison.md`. */
const shortPathOf = (path) => path.split('/').slice(-2).join('/');

/** A run of path characters. A sentence can end on one, so `namedPaths` drops the full stops after it. */
const PATH_LIKE = /[\w./-]+/g;

const namedPaths = (bodyLine) => (bodyLine.match(PATH_LIKE) ?? []).map((name) => name.replace(/\.+$/, ''));

const endsOnSegments = (path, tail) => path === tail || path.endsWith(`/${tail}`);

/**
 * Whole segments, not a substring: `label/comparison.md` is the end of `richtextlabel/comparison.md`
 * too, so a substring gives the owner of one sheet to the other.
 */
function namesFile(bodyLine, path) {
  const shortPath = shortPathOf(path);
  return namedPaths(bodyLine).some((name) => endsOnSegments(path, name) && endsOnSegments(name, shortPath));
}

/** The results a check ends on with nothing for its pull request to fix. */
const PASSED_RESULTS = new Set(['success', 'skipped', 'neutral']);

/** The files that hold a table of exemptions from a gate, each with what its table exempts. */
export const EXEMPTION_TABLES = new Map([
  ['packages/textscene-core/src/linter/fixtureLint.test.ts', 'the advisories a unit fixture may report'],
  ['scripts/testOnlyExports.core.mjs', 'the exports kept although only tests import them'],
  ['scripts/ci/visualScope.mjs', 'the files a change may touch with no visual run'],
  ['eslint.config.js', 'the lint rules and the files they skip'],
  ['scripts/vendor-prune.mjs', 'the importers whose sidecars the previewer reads'],
  ['scripts/import-sidecar-allowlist.test.mjs', 'the import parameters a vendored sidecar may set'],
  ['scripts/resourceLookups.test.mjs', 'the readers not moved onto resources/reading yet'],
  ['scripts/scope-cuts/knownUnownedCuts.mjs', 'the scope cuts of a document that name no owner'],
]);

/**
 * @typedef {object} BranchChange
 * @property {{ sha: string, branch: string }} head
 * @property {{ ref: string, sha: string }} base - the ref the branch left, and the commit where it left.
 * @property {string} nameStatus - `git diff --name-status --no-renames <base.sha> <head.sha>` output.
 * @property {string} diff - `git diff -U0 <base.sha> <head.sha>` output, uncoloured, with the `a/` and `b/` prefixes.
 * @property {Document[]} documents - each Markdown file the change adds or edits, a comparison sheet left out.
 * @property {boolean} [hasUncommittedChanges] - whether the working tree differs from the head.
 * @property {string[]} unkeptTestOnlyExports - each `file#name` only tests import, the kept ones left out.
 * @property {PullRequest} [pullRequest]
 */

/**
 * @typedef {object} Document
 * @property {string} path
 * @property {string} text - the whole file at the head: a cut takes its meaning from the list it stands in.
 */

/**
 * @typedef {object} PullRequest
 * @property {number} number
 * @property {boolean} draft
 * @property {string} mergeableState
 * @property {string} headSha
 * @property {string} baseBranch
 * @property {string} body
 * @property {Check[]} checks - the latest run of each check on `headSha`.
 * @property {{ number: number, body: string }[]} closedIssues - each issue the body closes.
 */

/**
 * @typedef {object} Check
 * @property {string} name
 * @property {string} result - GitHub's conclusion, or its status for a check with no conclusion yet.
 */

/** The states, the head, the base and the body of a pull request, from GitHub's JSON for it. */
export function parsePullRequest(json) {
  const { number, draft, mergeable_state: mergeableState, head, base, body } = JSON.parse(json);
  // GitHub gives null, not an empty string, for a pull request with no body.
  return { number, draft, mergeableState, headSha: head.sha, baseBranch: base.ref, body: body ?? '' };
}

/**
 * The latest run of each check of `tsv`, which holds one `<name>\t<result>\t<start time>` line for
 * each run. A commit holds a run of a job for each event that started its workflow, so a name repeats.
 *
 * @returns {Check[]}
 */
export function parseCheckRuns(tsv) {
  const latestRunOf = new Map();
  for (const line of tsv.split('\n')) {
    if (line === '') continue;
    const [name, result, startedAt] = line.split('\t');
    // ISO 8601 times in UTC sort as text.
    if (!latestRunOf.has(name) || startedAt >= latestRunOf.get(name).startedAt) {
      latestRunOf.set(name, { result, startedAt });
    }
  }
  return [...latestRunOf].map(([name, { result }]) => ({ name, result }));
}

/**
 * The added limit lines of a file that no line of the pull request body names beside an owner. The
 * body names a file, not a line, so one owner line covers every limit line the change adds to that file.
 *
 * @param {Pick<BranchChange, 'diff'> & { pullRequest: Pick<PullRequest, 'body'> }} change
 */
export function unownedLimitLines({ diff, pullRequest }) {
  const ownerLines = pullRequest.body.split('\n').filter((line) => NAMES_OWNER.test(line));
  const hasOwner = ({ path }) => ownerLines.some((line) => namesFile(line, path));
  return addedLines(diff).filter((line) => isLimitLine(line) && !hasOwner(line));
}

/** The words with which a body closes an issue on merge, as GitHub reads them. */
const CLOSES_ISSUE = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi;

/** The number of each issue `body` closes, once each, in the order the body names them. */
export function closedIssueNumbers(body) {
  return [...new Set([...body.matchAll(CLOSES_ISSUE)].map(([, digits]) => Number(digits)))];
}

/**
 * The scope cuts that name no owner: in the pull request body, in a line the change adds to a
 * document, and in each issue the pull request closes. A sheet is not read here: its limit lines
 * take their owner from the body.
 *
 * @param {Pick<BranchChange, 'diff' | 'documents'> & { pullRequest: Pick<PullRequest, 'body' | 'closedIssues'> }} change
 * @returns {{ where: string, line: number, text: string }[]}
 */
export function unownedScopeCutsOf({ diff, documents, pullRequest }) {
  const added = addedLines(diff);
  const isAdded = (path, line) => added.some((addition) => addition.path === path && addition.line === line);
  const cutsOf = (where, markdown) => unownedScopeCuts(markdown).map((cut) => ({ where, ...cut }));
  return [
    ...cutsOf('the pull request body', pullRequest.body),
    ...documents.flatMap(({ path, text }) => cutsOf(path, text).filter(({ line }) => isAdded(path, line))),
    ...pullRequest.closedIssues.flatMap(({ number, body }) => cutsOf(`issue #${number}`, body)),
  ];
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
    section(
      'Added lines that defer work or record a limit',
      addedLines(change.diff).filter(isFlagged).map(quoted)
    ),
    section('Exemption tables edited', files.flatMap(exemptionEntry)),
    section(
      'Test-only exports',
      change.unkeptTestOnlyExports.map((id) => `\`${id}\``)
    ),
    ...pullRequestSections(change),
  ].join('\n');
}

function pullRequestSections(change) {
  if (!change.pullRequest) return [];
  return [
    section('Checks not passed', change.pullRequest.checks.filter(hasNotPassed).map(checkEntry)),
    section('Limit lines with no owner in the pull request body', unownedLimitLines(change).map(quoted)),
    section('Scope cuts with no owner', unownedScopeCutsOf(change).map(cutEntry)),
  ];
}

const hasNotPassed = ({ result }) => !PASSED_RESULTS.has(result);

const checkEntry = ({ name, result }) => `\`${name}\`: ${result}`;

function headLines({ head, base, pullRequest, hasUncommittedChanges }) {
  const lines = [
    `- Head: \`${head.sha}\` on \`${head.branch}\``,
    `- Base: \`${base.ref}\` at \`${base.sha}\``,
  ];
  if (pullRequest) lines.push(...pullRequestLines(pullRequest, { head, base }));
  if (hasUncommittedChanges) lines.push(UNCOMMITTED_CHANGES_LINE);
  return lines;
}

/** The export scan reads the files on disk, so only a clean working tree makes it describe the head. */
const UNCOMMITTED_CHANGES_LINE =
  '- The working tree has uncommitted changes. The test-only exports describe it, not the head. Commit or stash first.';

/**
 * The state of the pull request and of its checks. A pull request with another head or another base
 * than the report makes every section below describe another change, so each gets its warning.
 */
function pullRequestLines({ number, draft, mergeableState, headSha, baseBranch, checks }, { head, base }) {
  const lines = [
    `- Pull request #${number}: ${draft ? 'draft' : 'ready'}, mergeable state \`${mergeableState}\``,
  ];
  if (headSha !== head.sha) {
    lines[0] += `. Its head is \`${headSha}\`, not the local head. Push or pull first.`;
  }
  if (!isRefOfBranch(base.ref, baseBranch)) {
    lines.push(`- Its base is \`${baseBranch}\`, not \`${base.ref}\`. Pass \`--base origin/${baseBranch}\`.`);
  }
  return [...lines, checksLine(checks)];
}

/** Whether `ref` names `branch`, as the local branch or as the branch of a remote. */
const isRefOfBranch = (ref, branch) => ref === branch || ref.endsWith(`/${branch}`);

/** The count of checks for each result, in the order the results first appear. */
function checksLine(checks) {
  const checksOfResult = Map.groupBy(checks, ({ result }) => result);
  const counts = [...checksOfResult].map(([result, { length }]) => `${length} ${result}`);
  return `- Checks on its head: ${counts.join(', ') || 'none'}`;
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

const cutEntry = ({ where, line, text }) => `\`${where}:${line}\` ${text}`;

const quoted = ({ path, line, text }) => `\`${path}:${line}\` ${text.trim()}`;

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
