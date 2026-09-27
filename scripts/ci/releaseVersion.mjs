#!/usr/bin/env node
/**
 * Reads a release tag before anything is built: which package it releases, and whether that
 * package's manifest holds the tagged version. The registries take the version from the
 * manifest, never the tag, so a mismatch would publish a version nobody tagged. Prints
 * `package`, `version` and `previous_tag` lines for $GITHUB_OUTPUT, or the error on stderr
 * and exits 1.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT } from '../repoRoot.mjs';

/** Each tag prefix, and the manifest of the one package that tag releases. */
export const RELEASE_PACKAGES = {
  vscode: 'apps/textscene-vscode/package.json',
  linter: 'apps/textscene-linter/package.json',
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
function parseReleaseTag(tag) {
  const match = RELEASE_TAG_RE.exec(tag);
  if (!match) return null;
  const parts = match.slice(2).map(Number);
  return { package: match[1], version: parts.join('.'), parts };
}

/**
 * @param {string} tag - the pushed tag name, as `GITHUB_REF_NAME` gives it.
 * @param {(manifestPath: string) => string} readVersion - the `version` of a repo-relative manifest.
 * @returns {{ package: string, version: string } | { error: string }}
 */
export function checkReleaseTag(tag, readVersion) {
  const release = parseReleaseTag(tag);
  if (!release) {
    return { error: `expected a tag like vscode-v1.2.3 or linter-v1.2.3, got ${JSON.stringify(tag)}` };
  }
  const manifestPath = RELEASE_PACKAGES[release.package];
  if (!manifestPath) {
    const known = Object.keys(RELEASE_PACKAGES).join(', ');
    return { error: `expected a tag prefix out of ${known}, got ${JSON.stringify(release.package)}` };
  }
  const manifestVersion = readVersion(manifestPath);
  if (manifestVersion !== release.version) {
    return {
      error: `${manifestPath} has version ${manifestVersion}, the tag says ${release.version}`,
    };
  }
  return { package: release.package, version: release.version };
}

function compareParts(a, b) {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/**
 * The highest release tag of the same package below `tag`, the base the release notes
 * compare against. Without it, GitHub may compare against the other package's tag.
 * @param {string} tag - a valid release tag.
 * @param {string[]} tags - every tag in the repository.
 * @returns {string} the tag, or '' for a package's first release.
 */
export function previousReleaseTag(tag, tags) {
  const current = parseReleaseTag(tag);
  const earlier = tags
    .map((name) => ({ name, release: parseReleaseTag(name) }))
    .filter(({ release }) => release?.package === current.package)
    .filter(({ release }) => compareParts(release.parts, current.parts) < 0)
    .sort((a, b) => compareParts(b.release.parts, a.release.parts));
  return earlier[0]?.name ?? '';
}

function readVersion(manifestPath) {
  return JSON.parse(readFileSync(join(REPO_ROOT, manifestPath), 'utf8')).version;
}

function listTags() {
  return execFileSync('git', ['tag', '--list'], { cwd: REPO_ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

function main() {
  const tag = process.argv[2] ?? '';
  const result = checkReleaseTag(tag, readVersion);
  if ('error' in result) {
    console.error(`[releaseVersion] ${result.error}`);
    process.exit(1);
  }
  console.log(`package=${result.package}`);
  console.log(`version=${result.version}`);
  console.log(`previous_tag=${previousReleaseTag(tag, listTags())}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
