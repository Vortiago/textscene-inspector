/**
 * The third-party code the repository transcribes, and the notices a bundle of it must carry.
 * `THIRD-PARTY-NOTICES.md` at the repository root is authoritative. A package that bundles part of
 * the code derives its own notices from it, so they never name code the package lacks.
 */

/**
 * Each third party: its `## ` section in THIRD-PARTY-NOTICES.md, and the copyright line that every
 * source file derived from it carries. The bundler strips the inline notice, so this line finds
 * the files in a source tree and in a bundle's inputs. `listFiles` swaps the section's file list
 * for the bundled files; only Godot's section lists files.
 */
export const NOTICE_SOURCES = [
  {
    section: 'Godot Engine',
    copyright: /Copyright \(c\) 2007-2014 Juan Linietsky, Ariel Manzur/,
    listFiles: listBundledGodotFiles,
  },
  { section: 'bcdec block decoder', copyright: /Copyright \(c\) 2022 Sergii Kudlai/ },
  { section: 'FastLZ', copyright: /Copyright \(C\) 2005-2020 Ariya Hidayat/ },
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
