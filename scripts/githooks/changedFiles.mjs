/** The changed and deleted paths in the output of `git diff --name-status --no-renames`. */

/** The paths in `text`, one `<status>\t<path>` entry per line, split by whether they still exist. */
export function parseNameStatus(text) {
  const changed = [];
  const deleted = [];
  for (const entry of text.split('\n')) {
    const [status, path] = entry.split('\t');
    if (!path) continue;
    (status === 'D' ? deleted : changed).push(path);
  }
  return { changed, deleted };
}
