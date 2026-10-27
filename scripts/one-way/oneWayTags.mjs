/**
 * Reads the `@oneWay` tags of the core's source as a list of shared helpers. A tag sits in the doc
 * comment of an export: its first line is the job, and the lines after it, up to the next tag, are
 * a note. The list then names only exports that exist.
 */

const DOC_COMMENT = /\/\*\*([\s\S]*?)\*\/[ \t]*\n([^\n]*)/g;
const EXPORT_NAME =
  /^export\s+(?:default\s+)?(?:declare\s+)?(?:async\s+)?(?:abstract\s+)?(?:function\*?|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/;
const TAG = /^@(\w+)\s*(.*)$/;

/**
 * The tagged exports of one source file, in the order they appear. `file` is the path the list
 * prints, relative to the core's `src/`. Throws on a tag that is not on an export or has no job.
 */
export function oneWayEntries(text, file) {
  const entries = [];
  for (const match of text.matchAll(DOC_COMMENT)) {
    const tag = oneWayTag(match[1]);
    if (!tag) continue;
    const declaration = match[2].trim();
    const name = EXPORT_NAME.exec(declaration)?.[1];
    if (!name) {
      const line = text.slice(0, match.index + match[0].length).split('\n').length;
      throw new Error(
        `${file}:${line}: expected an export after the @oneWay doc comment, got "${declaration}"`
      );
    }
    if (!tag.job) throw new Error(`${file}: expected a job after @oneWay on ${name}, got none`);
    entries.push({ job: tag.job, note: tag.note, name, file });
  }
  return entries;
}

/** The job and note of the comment's `@oneWay` tag, or null when it has none. */
function oneWayTag(body) {
  const lines = body.split('\n').map((line) => line.replace(/^\s*\*?\s?/, '').trim());
  const start = lines.findIndex((line) => TAG.exec(line)?.[1] === 'oneWay');
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('@'));
  const note = (end === -1 ? rest : rest.slice(0, end)).filter(Boolean).join(' ');
  return { job: TAG.exec(lines[start])[2].trim(), note };
}

/**
 * The list: one line for each job, so a grep for a word of the job prints the whole entry. Its
 * helpers are grouped by file, ordered by the path of the first, with the test helpers last.
 */
export function renderOneWayList(entries) {
  const jobs = new Map();
  for (const entry of entries) {
    if (!jobs.has(entry.job)) jobs.set(entry.job, []);
    jobs.get(entry.job).push(entry);
  }
  return [...jobs.values()].sort(compareJobs).map(item).join('\n') + '\n';
}

function compareJobs([a], [b]) {
  return isTestHelper(a) - isTestHelper(b) || a.file.localeCompare(b.file) || a.job.localeCompare(b.job);
}

function isTestHelper({ file }) {
  return /(^|\/)testing\/|\.testkit\./.test(file);
}

function item(helpers) {
  const files = new Map();
  for (const { name, file } of helpers) {
    if (!files.has(file)) files.set(file, []);
    files.get(file).push(`\`${name}\``);
  }
  const where = [...files].map(([file, names]) => `${joinAnd(names)} in \`${file}\``);
  const notes = helpers.map(({ note }) => note).filter(Boolean);
  return [`- ${helpers[0].job}: ${where.join(', and ')}.`, ...notes].join(' ');
}

function joinAnd(names) {
  return names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}
