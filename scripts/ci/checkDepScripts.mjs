#!/usr/bin/env node
/**
 * The install-script guard: fails when a lockfile entry declares preinstall, install or
 * postinstall outside the names package.json's `pnpm.onlyBuiltDependencies` allows. pnpm records
 * `hasInstallScript: true` whether or not it runs the script, so the check gates every pull
 * request on `pnpm check:dep-scripts` in CI's static job and in the pre-push gate.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';
import { REPO_ROOT } from '../repoRoot.mjs';

const LOCKFILE_PATH = join(REPO_ROOT, 'pnpm-lock.yaml');
const PACKAGE_JSON_PATH = join(REPO_ROOT, 'package.json');

/**
 * @param {string} lockfileText - the full text of `pnpm-lock.yaml`.
 * @returns {string[]} the ids of the `packages:` entries that set `hasInstallScript: true`, as
 *   pnpm writes them: `brotli@2.1.0`, `@textscene/renderer@0.2.0`.
 */
export function depEntriesWithInstallScripts(lockfileText) {
  const lockfile = parse(lockfileText) ?? {};
  return Object.entries(lockfile.packages ?? {})
    .filter(([, entry]) => entry?.hasInstallScript === true)
    .map(([id]) => id);
}

/**
 * @param {string} packageJsonText - the full text of the root `package.json`.
 * @returns {string[]} the package names whose scripts `pnpm.onlyBuiltDependencies` permits.
 * @throws {Error} when the field is absent or not an array. It is the security switch: once it
 *   is gone, pnpm 9 runs every dependency's script again.
 */
export function allowedBuildPackages(packageJsonText) {
  const allowlist = JSON.parse(packageJsonText)?.pnpm?.onlyBuiltDependencies;
  if (!Array.isArray(allowlist)) {
    throw new Error(
      `expected an array of names in package.json's pnpm.onlyBuiltDependencies, got ${JSON.stringify(allowlist)}`
    );
  }
  return allowlist;
}

/**
 * @param {string[]} entryIds - the return of `depEntriesWithInstallScripts`.
 * @param {string[]} allowlist - the return of `allowedBuildPackages`.
 * @returns {string[]} the ids whose package would run a script the root does not allow.
 */
export function entriesOutsideAllowlist(entryIds, allowlist) {
  const allowed = new Set(allowlist);
  return entryIds.filter((id) => !allowed.has(packageNameOf(id)));
}

/**
 * The package name an entry id carries: `@textscene/renderer@0.2.0` → `@textscene/renderer`. An
 * id the split cannot read, a git or a tarball dependency, never matches the allowlist, so it
 * fails closed.
 */
export function packageNameOf(entryId) {
  const parenthesis = entryId.indexOf('(');
  const withoutPeerSuffix = parenthesis === -1 ? entryId : entryId.slice(0, parenthesis);
  const versionSeparator = withoutPeerSuffix.lastIndexOf('@');
  return versionSeparator > 0 ? withoutPeerSuffix.slice(0, versionSeparator) : withoutPeerSuffix;
}

function main() {
  try {
    const entries = depEntriesWithInstallScripts(readFileSync(LOCKFILE_PATH, 'utf8'));
    const allowlist = allowedBuildPackages(readFileSync(PACKAGE_JSON_PATH, 'utf8'));
    const offenders = entriesOutsideAllowlist(entries, allowlist);
    for (const id of entries) {
      if (!offenders.includes(id)) {
        console.error(`[checkDepScripts] allowlisted, pnpm runs its script: ${id}`);
      }
    }
    if (offenders.length === 0) {
      console.error('[checkDepScripts] 0 packages with install scripts outside the allowlist');
      return;
    }
    for (const id of offenders) {
      console.error(`[checkDepScripts] ${id} declares an install script, not in pnpm.onlyBuiltDependencies`);
    }
    process.exitCode = 1;
  } catch (e) {
    console.error(`[checkDepScripts] ${e.message}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
