const NEW_FILE = /^\+\+\+ (?:b\/(.*)|\/dev\/null)$/;
const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

/** The 1-based lines each new path gains in `git diff --unified=0` output. A deleted file has none. */
export function addedLines(diff) {
  const added = new Map();
  let lines;
  for (const line of diff.split('\n')) {
    const file = NEW_FILE.exec(line);
    if (file) {
      lines = file[1] === undefined ? undefined : new Set();
      if (lines) added.set(file[1], lines);
      continue;
    }
    const hunk = HUNK.exec(line);
    if (!hunk || !lines) continue;
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    for (let offset = 0; offset < count; offset++) lines.add(start + offset);
  }
  return added;
}
