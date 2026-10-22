/**
 * The third-party code the repository transcribes, and the notices a bundle of it must carry.
 * `THIRD-PARTY-NOTICES.md` at the repository root is authoritative. A package that bundles part of
 * the code derives its own notices from it, so they never name code the package lacks.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { REPO_ROOT } from './repoRoot.mjs';

/**
 * Each third party: its `## ` section in THIRD-PARTY-NOTICES.md, and the line that every file
 * derived from it carries. The bundler strips the inline notice, so this line finds the files in a
 * source tree and in a bundle's inputs. `listFiles` swaps the section's file list for the bundled
 * files; only Godot's section lists files. `isInstalled` marks code that lives in an installed
 * package, which no scan of the repository's sources finds.
 */
export const NOTICE_SOURCES = [
  {
    section: 'Godot Engine',
    copyright: /Copyright \(c\) 2007-2014 Juan Linietsky, Ariel Manzur/,
    listFiles: listBundledGodotFiles,
  },
  { section: 'Open Sans font', copyright: /OFL-1\.1/ },
  { section: 'Activision fast filter coefficients', copyright: /Copyright 2016 Activision\sPublishing/ },
  { section: 'PCG random number generator', copyright: /thirdparty\/misc\/pcg\.cpp/ },
  { section: 'bcdec block decoder', copyright: /Copyright \(c\) 2022 Sergii Kudlai/ },
  { section: 'FastLZ', copyright: /Copyright \(C\) 2005-2020 Ariya Hidayat/ },
  { section: 'FastNoiseLite', copyright: /Copyright\(c\) 2023 Jordan Peck/, isInstalled: true },
];

/**
 * @param {string} notices - the text of THIRD-PARTY-NOTICES.md.
 * @param {{ path: string, text: string }[]} bundledFiles - the source files in the bundle, with
 *   their repo-relative path and their text.
 * @returns {string} the preamble, then the section of each third party that a bundled file derives
 *   from.
 */
export function bundledNotices(notices, bundledFiles) {
  const [preamble, ...sections] = notices.split(/^---\n\n/m);
  const kept = NOTICE_SOURCES.flatMap(({ section, copyright, listFiles = (body) => body }) => {
    const files = bundledFiles.filter(({ text }) => copyright.test(text)).map(({ path }) => path);
    if (files.length === 0) return [];
    const body = sections.find((candidate) => candidate.startsWith(`## ${section}\n`));
    if (!body) throw new Error(`expected a "## ${section}" section in the notices, found none`);
    return [listFiles(body, files)];
  });
  return [preamble, ...kept].map((part) => part.trimEnd()).join('\n\n---\n\n') + '\n';
}

/** Godot's section lists every transcribed file of the repository, then the licence they share. */
function listBundledGodotFiles(section, files) {
  const fileList = section.indexOf('### Transcribed source');
  const licence = section.indexOf('### Licence');
  if (fileList < 0 || licence < fileList) {
    throw new Error('expected "### Transcribed source" before "### Licence" in the Godot section');
  }
  const list = files.map((path) => `- \`${path}\``).join('\n');
  return `${section.slice(0, fileList)}### Bundled source\n\n${list}\n\n${section.slice(licence)}`;
}

/**
 * The files a package's bundle holds, as `bundledNotices` reads them. A compiled file of core keeps
 * the copyright line of its source, and the notices name the source, which its source map gives.
 * A file of an installed package is named where it stands.
 *
 * @param {{ inputs: Record<string, unknown> }} metafile - the esbuild metafile of the bundle.
 * @param {{ packageDir: string, ownSourceDir: string }} where - the package, and its own TypeScript.
 * @returns {{ path: string, text: string }[]}
 */
export function bundledSourceFiles(metafile, { packageDir, ownSourceDir }) {
  // A stylesheet holds no code, and core's build copies it without a source map.
  return Object.keys(metafile.inputs)
    .filter((input) => !input.endsWith('.css'))
    .map((input) => {
      const compiled = resolve(packageDir, input);
      return {
        // A getter, so a source map is read only for a file that carries a copyright line.
        get path() {
          return relative(REPO_ROOT, sourceOf(compiled, ownSourceDir));
        },
        text: readFileSync(compiled, 'utf8'),
      };
    });
}

/** Writes the `THIRD-PARTY-NOTICES.md` of a package whose bundle holds the inputs of `metafile`. */
export function writeBundledNotices(metafile, { packageDir, ownSourceDir }) {
  const rootNotices = readFileSync(resolve(REPO_ROOT, 'THIRD-PARTY-NOTICES.md'), 'utf8');
  writeFileSync(
    resolve(packageDir, 'THIRD-PARTY-NOTICES.md'),
    bundledNotices(rootNotices, bundledSourceFiles(metafile, { packageDir, ownSourceDir }))
  );
}

/**
 * The package's own TypeScript has no source map and is its own source, as is a file of an
 * installed package. Any other file without a map would put a `dist/` path in the notices, so it
 * fails the build.
 */
function sourceOf(compiled, ownSourceDir) {
  if (compiled.startsWith(`${ownSourceDir}/`) || compiled.includes('/node_modules/')) return compiled;
  const mapPath = `${compiled}.map`;
  if (!existsSync(mapPath)) throw new Error(`expected a source map at ${mapPath}, found none`);
  const [source] = JSON.parse(readFileSync(mapPath, 'utf8')).sources;
  return resolve(dirname(compiled), source);
}
