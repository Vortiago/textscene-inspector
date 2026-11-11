/**
 * The report of a branch's state that `pnpm pr:state` prints, for a thread to paste into its
 * report of a pull request: the head, the changed baselines and scenes, the added lines that defer
 * work, the exemption tables it edits and the exports only tests import. It reads git's text only.
 */

import { goldenNameOf } from '../visual/baselinePath.mjs';

const CHANGE_WORDS = { A: 'added', D: 'removed' };

/** A line that puts work off or switches a test off: a reviewer asks for the reason of each. */
const DEFERS_WORK = /\b(TODO|FIXME|HACK)\b|\b(it|test|describe)\.(skip|todo|only)\b|\bfallback\b/;

/** A line that records a gap of a feature, in the words the comparison sheets use. */
const RECORDS_LIMIT = /known limitation|approximated|not supported|unsupported/i;

/** The files that hold a table of exemptions from a gate, each with what its table exempts. */
export const EXEMPTION_TABLES = new Map([
  ['packages/textscene-core/src/linter/fixtureLint.test.ts', 'the advisories a unit fixture may report'],
  ['scripts/testOnlyExports.core.mjs', 'the exports kept although only tests import them'],
  ['scripts/ci/visualScope.mjs', 'the files a change may touch with no visual run'],
  ['eslint.config.js', 'the lint rules and the files they skip'],
]);

/**
 * @typedef {object} BranchChange
 * @property {{ sha: string, branch: string }} head
 * @property {{ ref: string, sha: string }} base - the ref the branch left, and the commit where it left.
 * @property {string} nameStatus - `git diff --name-status --no-renames <base.sha> <head.sha>` output.
 * @property {string} diff - `git diff -U0 <base.sha> <head.sha>` output.
 * @property {string[]} unkeptTestOnlyExports - each `file#name` only tests import, the kept ones left out.
 * @property {{ number: number, draft: boolean, mergeableState: string, headSha: string }} [pullRequest]
 */

/**
 * @param {BranchChange} change
 * @returns {string} the report, as Markdown.
 */
export function prStateReport(change) {
  const files = parseChangedFiles(change.nameStatus);
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

function headLines({ head, base, pullRequest }) {
  const lines = [
    `- Head: \`${head.sha}\` on \`${head.branch}\``,
    `- Base: \`${base.ref}\` at \`${base.sha}\``,
  ];
  if (pullRequest) lines.push(pullRequestLine(pullRequest, head.sha));
  return lines;
}

/** A pull request behind or ahead of the local head makes every section below describe another commit. */
function pullRequestLine({ number, draft, mergeableState, headSha }, localSha) {
  const state = `- Pull request #${number}: ${draft ? 'draft' : 'ready'}, mergeable state \`${mergeableState}\``;
  return headSha === localSha
    ? state
    : `${state}; its head is \`${headSha}\`, not the local head. Push or pull first.`;
}

/** A titled list with its count, or "None." so an empty section reads as checked, not as missing. */
function section(title, entries) {
  const body = entries.length === 0 ? 'None.' : entries.map((entry) => `- ${entry}`).join('\n');
  return `## ${title} (${entries.length})\n\n${body}\n`;
}

/** The `{ change, path }` of each `<status>\t<path>` line. A type change reads as changed. */
function parseChangedFiles(nameStatus) {
  return nameStatus.split('\n').flatMap((line) => {
    const [status, path] = line.split('\t');
    return path ? [{ change: CHANGE_WORDS[status] ?? 'changed', path }] : [];
  });
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
    .filter(({ text }) => DEFERS_WORK.test(text) || RECORDS_LIMIT.test(text))
    .map(({ path, line, text }) => `\`${path}:${line}\` ${text.trim()}`);
}

/** Each line a unified diff adds, with its path and its line number in the new file. */
function addedLines(diff) {
  const added = [];
  let path = '';
  let line = 0;
  for (const text of diff.split('\n')) {
    if (text.startsWith('+++ ')) {
      path = text.slice('+++ b/'.length);
    } else if (text.startsWith('@@')) {
      line = Number(/\+(\d+)/.exec(text)?.[1]);
    } else if (text.startsWith('+')) {
      added.push({ path, line, text: text.slice(1) });
      line += 1;
    }
  }
  return added;
}
