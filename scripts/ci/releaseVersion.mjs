#!/usr/bin/env node
/**
 * Checks a release tag against the versions of the packages the release publishes, before
 * anything is built. The registries take the version from the manifest, never the tag, so
 * a mismatch would publish a version nobody tagged. Prints `version=<x.y.z>` for
 * $GITHUB_OUTPUT, or each mismatch on stderr and exits 1.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT } from '../repoRoot.mjs';

/** The manifests of the packages a release publishes, repo-relative. */
export const PUBLISHED_MANIFESTS = [
  'apps/textscene-vscode/package.json',
  'apps/textscene-linter/package.json',
];

/**
 * Plain `v<major>.<minor>.<patch>` only. The VS Marketplace refuses a semver pre-release
 * suffix, so a `v1.0.0-rc.1` tag would fail after npm had already published it.
 */
const RELEASE_TAG_RE = /^v(\d+\.\d+\.\d+)$/;

/**
 * @param {string} tag - the pushed tag name, as `GITHUB_REF_NAME` gives it.
 * @param {{ path: string, version: string }[]} manifests
 * @returns {{ version: string | null, errors: string[] }} the tag's version, or null when
 *   the tag is not a release tag, and one message per mismatch.
 */
export function checkReleaseVersion(tag, manifests) {
  const match = RELEASE_TAG_RE.exec(tag);
  if (!match) {
    return { version: null, errors: [`expected a tag like v1.2.3, got ${JSON.stringify(tag)}`] };
  }
  const version = match[1];
  const errors = manifests
    .filter((manifest) => manifest.version !== version)
    .map((manifest) => `${manifest.path} has version ${manifest.version}, the tag says ${version}`);
  return { version, errors };
}

function readManifest(path) {
  return { path, version: JSON.parse(readFileSync(join(REPO_ROOT, path), 'utf8')).version };
}

function main() {
  const tag = process.argv[2] ?? '';
  const { version, errors } = checkReleaseVersion(tag, PUBLISHED_MANIFESTS.map(readManifest));
  if (errors.length > 0) {
    for (const error of errors) console.error(`[releaseVersion] ${error}`);
    process.exit(1);
  }
  console.log(`version=${version}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
