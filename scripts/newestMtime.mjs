/**
 * The walk behind the staleness guards: newest mtime under a tree, and which
 * file carries it.
 *
 * Two guards refuse to measure against a build older than its sources — the
 * coverage ledger (`dist/` vs `src/`) and the visual harness (the web bundle vs
 * the sources it claims to contain). They differ in what counts as a source and
 * in what they do about it, so only the walk is shared; the filters and the
 * verdicts stay with each caller.
 */

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Newest mtime under `dir` among files `keep` accepts, and which file carries
 * it. `keep` and `enterDir` both take a bare entry name; a directory `enterDir`
 * rejects is not descended into.
 *
 * An unreadable directory contributes nothing rather than throwing: "not there"
 * is the unbuilt case, which every caller reports in its own words. It is
 * reported SEPARATELY from "there and empty" though, in `failed`. Collapsing
 * the two returned an mtime of 0 for a tree that could not be read, and a
 * caller comparing `0 > stamp` then read fresh over a walk that never happened
 * — the one answer a freshness guard must never give.
 *
 * `statSync` sits inside the same try as `readdirSync`: a concurrent build
 * unlinking an output between the two throws ENOENT, and a walk is not the
 * place to turn that into a crash.
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
