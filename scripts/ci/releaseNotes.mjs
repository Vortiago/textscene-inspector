#!/usr/bin/env node
/**
 * Writes the notes for one package's GitHub Release. The notes list the user-facing commits
 * since the package's previous tag that touch the package or a package it ships, grouped by
 * Conventional Commit type. An annotated tag's message goes first, as the highlights.
 * Prints the Markdown on stdout.
 */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT } from '../repoRoot.mjs';
import { RELEASE_PACKAGES, parseReleaseTag } from './releaseVersion.mjs';

/** The workspace packages each release bundles, besides its own directory. */
export const RELEASE_INPUTS = {
  vscode: ['packages/textscene-core', 'apps/textscene-web'],
  linter: ['packages/textscene-core'],
  lsp: ['packages/textscene-core'],
};

/** The sections of the notes, in order. A commit of any other type is not user-facing. */
const SECTIONS = [
  { title: 'Breaking changes', includes: (commit) => commit.isBreaking },
  { title: 'Features', includes: (commit) => commit.type === 'feat' },
  { title: 'Fixes', includes: (commit) => commit.type === 'fix' },
  { title: 'Performance', includes: (commit) => commit.type === 'perf' },
];

/**
 * Scopes of repository tooling. A `perf(githooks)` commit can touch a package's manifest, yet
 * ships nothing.
 */
const TOOLING_SCOPES = new Set(['ci', 'devcontainer', 'githooks', 'lint', 'visual']);

const HEADER_RE = /^(\w+)(?:\(([^)]*)\))?(!)?: (.+)$/;
const BREAKING_FOOTER_RE = /^BREAKING[ -]CHANGE: /m;

/** The ASCII separators `readCommits` asks git for: they never occur in a commit message. */
const FIELD_SEPARATOR = '\x1f';
const RECORD_SEPARATOR = '\x1e';

/**
 * @param {string} tag
 * @returns {string[]} the repo-relative directories whose commits belong in `tag`'s notes.
 */
export function releaseSources(tag) {
  const release = parseReleaseTag(tag);
  const directory = release && RELEASE_PACKAGES[release.package];
  if (!directory) throw new Error(`expected a release tag like vscode-v1.2.3, got ${JSON.stringify(tag)}`);
  return [directory, ...RELEASE_INPUTS[release.package]];
}

/**
 * @param {string} log - `git log` output in the `readCommits` format.
 * @returns {{ type: string, description: string, isBreaking: boolean }[]} one entry per
 *   commit whose header is a Conventional Commit outside a tooling scope, newest first.
 */
export function parseCommitLog(log) {
  return log
    .split(RECORD_SEPARATOR)
    .map((record) => record.replace(/^\n/, ''))
    .filter(Boolean)
    .flatMap((record) => {
      const [subject, body = ''] = record.split(FIELD_SEPARATOR);
      const header = HEADER_RE.exec(subject.trim());
      if (!header) return [];
      const [, type, scope, bang, description] = header;
      if (TOOLING_SCOPES.has(scope)) return [];
      return [{ type, description, isBreaking: Boolean(bang) || BREAKING_FOOTER_RE.test(body) }];
    });
}

/**
 * @param {string} ref - `git for-each-ref` output in the `readHighlights` format.
 * @returns {string} the tag message, or '' for a lightweight tag.
 */
export function parseTagMessage(ref) {
  const [objectType, subject = '', body = ''] = ref.split(FIELD_SEPARATOR);
  if (objectType !== 'tag') return '';
  return [subject, body]
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n\n');
}

function renderSections(commits) {
  const sections = SECTIONS.map(({ title, includes }) => {
    const entries = commits.filter(includes).map((commit) => `- ${commit.description}`);
    return entries.length ? `## ${title}\n\n${entries.join('\n')}` : '';
  }).filter(Boolean);
  return sections.length ? sections.join('\n\n') : 'No user-facing changes.';
}

/**
 * @param {{ highlights: string, commits: ReturnType<typeof parseCommitLog>, previousTag: string,
 *   compareUrl: string }} release - `previousTag` is '' on a package's first release, which
 *   lists no commits. `compareUrl` is '' when the repository URL is unknown.
 * @returns {string} the Markdown notes.
 */
export function renderReleaseNotes({ highlights, commits, previousTag, compareUrl }) {
  if (!previousTag) return highlights || 'First public release.';
  const changelog = compareUrl && `**Full changelog**: ${compareUrl}`;
  return [highlights, renderSections(commits), changelog].filter(Boolean).join('\n\n');
}

function git(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
}

function readCommits(previousTag, tag) {
  const format = `--format=%s${FIELD_SEPARATOR}%b${RECORD_SEPARATOR}`;
  return git(['log', '--no-merges', format, `${previousTag}..${tag}`, '--', ...releaseSources(tag)]);
}

function readHighlights(tag) {
  const format = `--format=%(objecttype)${FIELD_SEPARATOR}%(contents:subject)${FIELD_SEPARATOR}%(contents:body)`;
  return git(['for-each-ref', format, `refs/tags/${tag}`]);
}

function compareUrl(previousTag, tag) {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY } = process.env;
  if (!GITHUB_SERVER_URL || !GITHUB_REPOSITORY) return '';
  return `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/compare/${previousTag}...${tag}`;
}

function main() {
  const [tag = '', previousTag = ''] = process.argv.slice(2);
  try {
    const notes = renderReleaseNotes({
      highlights: parseTagMessage(readHighlights(tag)),
      commits: previousTag ? parseCommitLog(readCommits(previousTag, tag)) : [],
      previousTag,
      compareUrl: compareUrl(previousTag, tag),
    });
    console.log(notes);
  } catch (error) {
    console.error(`[releaseNotes] ${error.message}`);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
