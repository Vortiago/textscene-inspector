#!/usr/bin/env node
/**
 * Reads a release tag before anything is built: which package it releases, and at which
 * version. The tag is the version's only source: the release jobs write it into the
 * package's manifest before they pack. Prints `package`, `directory`, `version` and
 * `previous_tag` lines for $GITHUB_OUTPUT, or the error on stderr and exits 1.
 */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT } from '../repoRoot.mjs';

/** Each tag prefix, and the repo-relative directory of the one package that tag releases. */
export const RELEASE_PACKAGES = {
  vscode: 'apps/textscene-vscode',
  linter: 'apps/textscene-linter',
  lsp: 'apps/textscene-lsp',
};

/**
 * `<package>-v<major>.<minor>.<patch>` only. The VS Marketplace refuses a semver pre-release
 * suffix, so a pre-release tag would fail at the last step.
 */
const RELEASE_TAG_RE = /^([a-z]+)-v(\d+)\.(\d+)\.(\d+)$/;

/**
 * @param {string} tag
 * @returns {{ package: string, version: string, parts: number[] } | null} null for a tag
 *   that is not a release tag.
 */
export function parseReleaseTag(tag) {
  const match = RELEASE_TAG_RE.exec(tag);
  if (!match) return null;
  const parts = match.slice(2).map(Number);
  return { package: match[1], version: parts.join('.'), parts };
}

function compareParts(a, b) {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/** The other release tags of `release`'s package, highest version first. */
function sameSeries(release, tags) {
  return tags
    .map((name) => ({ name, release: parseReleaseTag(name) }))
    .filter(({ release: other }) => other?.package === release.package)
    .filter(({ release: other }) => other.version !== release.version)
    .sort((a, b) => compareParts(b.release.parts, a.release.parts));
}

/**
 * @param {string} tag - the pushed tag name, as `GITHUB_REF_NAME` gives it.
 * @param {string[]} tags - every tag in the repository.
 * @returns {{ package: string, directory: string, version: string, previousTag: string }
 *   | { error: string }} `previousTag` is the base the release notes compare against, or ''
 *   for a package's first release.
 */
export function checkReleaseTag(tag, tags) {
  const release = parseReleaseTag(tag);
  if (!release) {
    return {
      error: `expected a tag like vscode-v1.2.3, linter-v1.2.3 or lsp-v1.2.3, got ${JSON.stringify(tag)}`,
    };
  }
  const directory = RELEASE_PACKAGES[release.package];
  if (!directory) {
    const known = Object.keys(RELEASE_PACKAGES).join(', ');
    return { error: `expected a tag prefix out of ${known}, got ${JSON.stringify(release.package)}` };
  }
  // A lower version would still publish, and npm would move its `latest` tag back to it.
  const [newest] = sameSeries(release, tags);
  if (newest && compareParts(newest.release.parts, release.parts) > 0) {
    return { error: `expected a version above the newest ${release.package} tag ${newest.name}, got ${tag}` };
  }
  return { package: release.package, directory, version: release.version, previousTag: newest?.name ?? '' };
}

function listTags() {
  return execFileSync('git', ['tag', '--list'], { cwd: REPO_ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

function main() {
  const result = checkReleaseTag(process.argv[2] ?? '', listTags());
  if ('error' in result) {
    console.error(`[releaseVersion] ${result.error}`);
    process.exit(1);
  }
  console.log(`package=${result.package}`);
  console.log(`directory=${result.directory}`);
  console.log(`version=${result.version}`);
  console.log(`previous_tag=${result.previousTag}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
