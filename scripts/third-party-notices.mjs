/**
 * The third-party code the repository transcribes, and the notices a bundle of it must carry.
 * `THIRD-PARTY-NOTICES.md` at the repository root is authoritative. A package that bundles part of
 * the code derives its own notices from it, so they never name code the package lacks.
 */

/**
 * Each third party: its `## ` section in THIRD-PARTY-NOTICES.md, and the copyright line that every
 * source file derived from it carries. The bundler strips the inline notice, so this line finds
 * the files in a source tree and in a bundle's inputs.
 */
export const NOTICE_SOURCES = [
  {
    name: 'Godot',
    section: 'Godot Engine',
    copyright: /Copyright \(c\) 2007-2014 Juan Linietsky, Ariel Manzur/,
  },
  { name: 'bcdec', section: 'bcdec block decoder', copyright: /Copyright \(c\) 2022 Sergii Kudlai/ },
  { name: 'FastLZ', section: 'FastLZ', copyright: /Copyright \(C\) 2005-2020 Ariya Hidayat/ },
];

/** Godot's section lists every transcribed file of the repository, then the licence they share. */
const GODOT_FILE_LIST = '### Transcribed source';
const GODOT_LICENCE = '### Licence';

/**
 * @param {string} notices - the text of THIRD-PARTY-NOTICES.md.
 * @param {{ path: string, text: string }[]} bundledFiles - the source files in the bundle, with
 *   their repo-relative path and their text.
 * @returns {string} the preamble, then the section of each third party that a bundled file derives
 *   from. Godot's section lists the bundled files in place of the repository's.
 */
export function bundledNotices(notices, bundledFiles) {
  const [preamble, ...sections] = notices.split(/^---\n\n/m);
  const kept = NOTICE_SOURCES.flatMap(({ section, copyright }) => {
    const files = bundledFiles.filter(({ text }) => copyright.test(text)).map(({ path }) => path);
    const body = sections.find((candidate) => candidate.startsWith(`## ${section}\n`));
    if (files.length === 0) return [];
    if (!body) throw new Error(`expected a "## ${section}" section in the notices, found none`);
    return [section === 'Godot Engine' ? withBundledFiles(body, files) : body];
  });
  return [preamble, ...kept].map((part) => part.trimEnd()).join('\n\n---\n\n') + '\n';
}

function withBundledFiles(godotSection, files) {
  const list = files.map((path) => `- \`${path}\``).join('\n');
  const before = godotSection.slice(0, godotSection.indexOf(GODOT_FILE_LIST));
  const licence = godotSection.slice(godotSection.indexOf(GODOT_LICENCE));
  return `${before}### Bundled source\n\n${list}\n\n${licence}`;
}
