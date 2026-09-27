#!/usr/bin/env node
/**
 * Fails when a public-edition build (`pnpm build:pages`) holds content of the dev edition:
 * the fixtures mirror, the parity gallery, a source map, a built-in scene's file name, or a
 * root-absolute URL, which breaks under GitHub Pages' /<repo>/ path.
 *
 * Usage: node scripts/check-public-site.mjs [dist-dir]
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFixtureManifest } from './fixtureManifest.mjs';
import { REPO_ROOT } from './repoRoot.mjs';

const DEFAULT_DIST = join(REPO_ROOT, 'apps/textscene-web/dist');

/** Top-level directories only the dev edition stages into `public/`. */
const DEV_ONLY_DIRS = ['fixtures', 'parity'];

/** Files whose text the check reads. The rest are only named. */
const TEXT_FILE_RE = /\.(html|js|css)$/;

/** A `src` or `href` that starts at the host root. `//host` and `data:` pass. */
const ROOT_ABSOLUTE_URL_RE = /\b(?:src|href)="\/(?!\/)[^"]*"/g;

/**
 * @param {{ path: string, text?: string }[]} files - every file under dist, with a
 *   posix path relative to it and the text of each HTML, JS and CSS file.
 * @param {string[]} sceneFiles - the `file` of every built-in scene in the manifest.
 * @returns {string[]} one line per leak, empty for a clean build.
 */
export function findPublicSiteLeaks(files, sceneFiles) {
  const leaks = [];
  for (const { path, text } of files) {
    const devOnlyDir = DEV_ONLY_DIRS.find((dir) => path.startsWith(`${dir}/`));
    if (devOnlyDir) {
      leaks.push(`${path}: a dev-only ${devOnlyDir}/ file`);
    }
    if (path.endsWith('.map')) {
      leaks.push(`${path}: a source map`);
    }
    if (text === undefined) continue;
    const sceneFile = sceneFiles.find((file) => text.includes(file));
    if (sceneFile) {
      leaks.push(`${path}: names the built-in scene ${sceneFile}`);
    }
    if (path.endsWith('.html')) {
      for (const [url] of text.matchAll(ROOT_ABSOLUTE_URL_RE)) {
        leaks.push(`${path}: root-absolute ${url}`);
      }
    }
  }
  return leaks;
}

/** @param {string} dist */
export function readDist(dist) {
  return readdirSync(dist, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const absolute = join(entry.parentPath, entry.name);
      const path = relative(dist, absolute).split(sep).join('/');
      return TEXT_FILE_RE.test(path) ? { path, text: readFileSync(absolute, 'utf8') } : { path };
    });
}

function main() {
  const dist = process.argv[2] ?? DEFAULT_DIST;
  const sceneFiles = readFixtureManifest().map((fixture) => fixture.file);
  const leaks = findPublicSiteLeaks(readDist(dist), sceneFiles);
  if (leaks.length > 0) {
    console.error(`[check:public-site] ${dist} holds dev-edition content:`);
    for (const leak of leaks) console.error(`  ${leak}`);
    process.exit(1);
  }
  console.log(`[check:public-site] ${dist} holds only the public edition`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
