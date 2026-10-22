#!/usr/bin/env node
/**
 * Reads a release tag before anything is built: which package it releases, and at which
 * version. The tag is the version's only source: the release jobs write it into the
 * package's manifest before they pack. Prints `package`, `kind`, `directory`, `version` and
 * `previous_tag` lines for $GITHUB_OUTPUT, or the error on stderr and exits 1.
 */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT } from '../repoRoot.mjs';

/**
 * Each tag prefix, and what its tag releases:
 * - `directory`: the repo-relative directory of the one package.
 * - `kind`: `npm` ships a tarball on GitHub and on npm; `extension` ships a .vsix to the
 *   marketplaces. The release workflow reads the kind, so it names no package.
 * - `inputs`: the workspace directories the package bundles, besides its own. Its release notes
 *   cover them.
 */
const RELEASE_TARGETS = {
  vscode: {
    directory: 'apps/textscene-vscode',
    kind: 'extension',
    inputs: ['packages/textscene-core', 'apps/textscene-web'],
  },
  linter: { directory: 'apps/textscene-linter', kind: 'npm', inputs: ['packages/textscene-core'] },
  lsp: { directory: 'apps/textscene-lsp', kind: 'npm', inputs: ['packages/textscene-core'] },
  tscn: { directory: 'apps/textscene-tscn', kind: 'npm', inputs: ['packages/textscene-core'] },
  renderer: { directory: 'apps/textscene-renderer', kind: 'npm', inputs: ['packages/textscene-core'] },
};

/** One field of `RELEASE_TARGETS`, keyed by tag prefix. */
const field = (name) => Object.fromEntries(Object.entries(RELEASE_TARGETS).map(([tag, t]) => [tag, t[name]]));

export const RELEASE_PACKAGES = field('directory');
export const RELEASE_INPUTS = field('inputs');

/** Own keys only: a tag like `constructor-v1.0.0` must not find `Object.prototype.constructor`. */
function releaseTarget(name) {
  return Object.hasOwn(RELEASE_TARGETS, name) ? RELEASE_TARGETS[name] : undefined;
}

/** Joins the example tags with "or", without the serial comma of American English. */
const DISJUNCTION = new Intl.ListFormat('en-GB', { type: 'disjunction' });

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
 * @returns {{ package: string, kind: string, directory: string, version: string, previousTag: string }
 *   | { error: string }} `previousTag` is the base the release notes compare against, or ''
 *   for a package's first release.
 */
export function checkReleaseTag(tag, tags) {
  const release = parseReleaseTag(tag);
  if (!release) {
    const examples = Object.keys(RELEASE_PACKAGES).map((name) => `${name}-v1.2.3`);
    return { error: `expected a tag like ${DISJUNCTION.format(examples)}, got ${JSON.stringify(tag)}` };
  }
  const target = releaseTarget(release.package);
  if (!target) {
    const known = Object.keys(RELEASE_PACKAGES).join(', ');
    return { error: `expected a tag prefix out of ${known}, got ${JSON.stringify(release.package)}` };
  }
  // A lower version would still publish, and npm would move its `latest` tag back to it.
  const [newest] = sameSeries(release, tags);
  if (newest && compareParts(newest.release.parts, release.parts) > 0) {
    return { error: `expected a version above the newest ${release.package} tag ${newest.name}, got ${tag}` };
  }
  return {
    package: release.package,
    kind: target.kind,
    directory: target.directory,
    version: release.version,
    previousTag: newest?.name ?? '',
  };
}

/**
 * @param {string} tag - a release tag, which `tags` need not hold.
 * @param {string[]} tags - every tag in the repository.
 * @returns {{ tag: string, version: string, previousTag: string }[]} `tag` and each lower tag
 *   of its package, highest version first. `previousTag` is the next lower tag, or '' for the
 *   first release.
 */
export function releaseHistory(tag, tags) {
  const release = parseReleaseTag(tag);
  if (!releaseTarget(release?.package)) {
    throw new Error(`expected a release tag like vscode-v1.2.3, got ${JSON.stringify(tag)}`);
  }
  const lower = sameSeries(release, tags).filter(
    (other) => compareParts(other.release.parts, release.parts) < 0
  );
  const history = [{ name: tag, release }, ...lower];
  return history.map(({ name, release: { version } }, i) => ({
    tag: name,
    version,
    previousTag: history[i + 1]?.name ?? '',
  }));
}

export function listTags() {
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
  console.log(`kind=${result.kind}`);
  console.log(`directory=${result.directory}`);
  console.log(`version=${result.version}`);
  console.log(`previous_tag=${result.previousTag}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
