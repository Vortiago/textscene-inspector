#!/usr/bin/env node
/**
 * Writes the "Goldens touched" comment for a pull request: one row per baseline it adds, changes
 * or removes, with links to GitHub's image diff and to the scene on the branch's and main's
 * Cloudflare Pages deploy. CI passes `git diff --name-status --no-renames` on stdin.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { GOLDEN_SCENES } from '../visual/scenes.mjs';

/** The first line of the comment, which the workflow searches for to update it in place. */
export const GOLDENS_COMMENT_MARKER = '<!-- goldens-touched -->';

const BASELINE_PATH = /^scripts\/visual\/baselines\/(.+)\.png$/;
const STATUS_WORDS = { A: 'added', M: 'changed', D: 'removed' };
const MAIN_SITE = 'https://textscene-inspector.pages.dev';

// Cloudflare Pages keeps 28 characters of the branch in a preview host: #629's
// `claude/issue-625-tiledata-...` deploys to `claude-issue-625-tiledata-vo`.
const BRANCH_ALIAS_LENGTH = 28;

// More rows than this push the rest of the pull request's conversation down too far.
const OPEN_ROW_LIMIT = 10;

/**
 * @param {string} nameStatus - `git diff --name-status --no-renames` output.
 * @param {{ name: string, file: string }[]} scenes - the golden-scene manifest of the branch.
 * @param {{ repository: string, number: number, branch: string }} pullRequest
 * @returns {string | null} the comment body, or null when no baseline changed.
 */
export function goldensComment(nameStatus, scenes, pullRequest) {
  const goldens = parseGoldens(nameStatus);
  if (goldens.length === 0) return null;
  const table = [
    '| Golden | Change | Image diff | This branch | Main |',
    '| --- | --- | --- | --- | --- |',
    ...goldens.map((golden) => row(golden, scenes, pullRequest)),
  ].join('\n');
  return [GOLDENS_COMMENT_MARKER, '## Goldens touched', '', fold(table, goldens), ''].join('\n');
}

/** The changed baselines, by name, in the order git lists them. */
function parseGoldens(nameStatus) {
  return nameStatus
    .split('\n')
    .map((line) => line.split('\t'))
    .filter(([, path]) => BASELINE_PATH.test(path ?? ''))
    .map(([status, path]) => ({ path, name: BASELINE_PATH.exec(path)[1], change: STATUS_WORDS[status] }));
}

/** An added golden has no scene on main, and a removed one has none on the branch. */
function row({ path, name, change }, scenes, { repository, number, branch }) {
  const fixture = scenes.find((scene) => scene.name === name)?.file;
  const diffAnchor = createHash('sha256').update(path).digest('hex');
  const diff = `[diff](https://github.com/${repository}/pull/${number}/files#diff-${diffAnchor})`;
  const preview = `https://${branchAlias(branch)}.textscene-inspector.pages.dev`;
  const onBranch = fixture && change !== 'removed' ? sceneLink('preview', preview, fixture) : '';
  const onMain = fixture && change === 'changed' ? sceneLink('main', MAIN_SITE, fixture) : '';
  return `| \`${name}\` | ${change} | ${diff} | ${onBranch} | ${onMain} |`;
}

function sceneLink(label, site, fixture) {
  return `[${label}](${site}/?fixture=${encodeURIComponent(fixture)})`;
}

/** The branch's preview host label: a DNS label ends in a letter or digit, never a hyphen. */
function branchAlias(branch) {
  return branch
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, BRANCH_ALIAS_LENGTH)
    .replace(/-+$/, '');
}

function fold(table, goldens) {
  if (goldens.length <= OPEN_ROW_LIMIT) return table;
  const counts = Object.values(STATUS_WORDS)
    .map((change) => [change, goldens.filter((golden) => golden.change === change).length])
    .filter(([, count]) => count > 0)
    .map(([change, count]) => `${count} ${change}`);
  return `<details><summary>${goldens.length} goldens: ${counts.join(', ')}</summary>\n\n${table}\n\n</details>`;
}

function main() {
  const [outputPath] = process.argv.slice(2);
  const pullRequest = {
    repository: process.env.REPOSITORY,
    number: Number(process.env.PR_NUMBER),
    branch: process.env.BRANCH,
  };
  const comment = goldensComment(readFileSync(0, 'utf8'), GOLDEN_SCENES, pullRequest);
  // An empty file tells the workflow to delete a comment an earlier push left.
  writeFileSync(outputPath, comment ?? '');
  console.error(`[goldensComment] ${comment ? 'wrote' : 'no goldens touched,'} ${outputPath}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
