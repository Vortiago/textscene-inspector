/**
 * The walk behind the staleness guards of the coverage ledger (`dist/` against `src/`) and the
 * visual harness (the web bundle against its sources): the newest mtime under a tree, and its
 * file. The two differ in what counts as a source and what they do, so only the walk is shared.
 */

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Newest mtime under `dir` among files `keep` accepts, and its file. `keep` and `enterDir` take a
 * bare entry name. An unreadable directory, the unbuilt case, does not throw: it goes in `failed`,
 * apart from "there and empty", since a caller comparing `0 > stamp` would read it as fresh.
 * `statSync` shares the try, since a concurrent build can unlink an output between the two calls.
 */
export function newestMtime(dir, keep, enterDir = () => true) {
  let at = 0;
  let file = '';
  let failed = false;
  const walk = (d) => {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      failed = true;
      return;
    }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (enterDir(e.name)) walk(p);
        continue;
      }
      if (!keep(e.name)) continue;
      let m;
      try {
        m = statSync(p).mtimeMs;
      } catch {
        failed = true;
        continue;
      }
      if (m > at) {
        at = m;
        file = p;
      }
    }
  };
  walk(dir);
  return { at, file, failed };
}
