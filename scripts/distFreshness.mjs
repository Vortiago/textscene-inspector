/**
 * Whether `packages/textscene-core/dist` is current enough for a ledger to be
 * read from it.
 *
 * Every ledger in this repo — coverage, engine property coverage, resource
 * property coverage, hint parity — measures the BUILT registries, because the
 * barrels use NodeNext `.js` specifiers over on-disk `.ts` and cannot be
 * imported from source. That makes an unbuilt or stale `dist/` the one failure
 * mode none of them can see: every assertion passes, about a previous revision.
 *
 * Refusing to measure is the point. `existsSync(dist)` was the earlier test and
 * it answers a weaker question: it cannot tell a fresh build from one that
 * predates the wave whose numbers the ledger is now reporting, and it SKIPS
 * rather than fails, so a contributor who has never built gets a green run over
 * guards that never executed.
 *
 * `pnpm validate` builds before it tests, so this never fires in CI — it guards
 * the local workflow alone.
 */

import { statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { newestMtime } from './newestMtime.mjs';

export const BUILD = 'pnpm --filter @textscene/core build';

/**
 * `tsc` emits `src/**` minus the tests, the test kit and the ambient
 * declarations, so an edit to those is not staleness: a guard that fires on
 * work it cannot be measuring is one people learn to bypass. Mirrors the
 * package tsconfig's `exclude`.
 */
const COMPILED = /\.tsx?$/;
const NOT_COMPILED = /\.d\.ts$|\.(test|spec)\.tsx?$/;

/** Newest kept file under `dir`; `testing/` is the excluded kit, at any depth. */
export const newest = (dir, keep) => newestMtime(dir, keep, (name) => name !== 'testing');

/**
 * An actionable complaint, or `null` when the build is current.
 *
 * @param core - the `packages/textscene-core` directory.
 * @param what - what the caller is about to measure, for the message.
 */
export function stalenessMessage(core, what = 'this ledger') {
  if (!newest(join(core, 'dist'), (n) => n.endsWith('.js')).at) {
    return `packages/textscene-core/dist is not built — run \`${BUILD}\`.`;
  }
  // Against tsc's OWN record of when it last evaluated the project, not against
  // the newest emitted `.js`. An incremental build does not rewrite an output
  // whose content did not change, so a no-op regeneration of a source file
  // (`pnpm nodes:catalog` rewriting nodeBaseTypes.generated.ts byte-identically)
  // left every `.js` older than it and no amount of rebuilding could clear the
  // complaint. A guard whose prescribed remedy does not work gets bypassed.
  let stamp;
  try {
    stamp = statSync(join(core, 'tsconfig.tsbuildinfo')).mtimeMs;
  } catch {
    return `packages/textscene-core has no tsconfig.tsbuildinfo — run \`${BUILD}\`.`;
  }
  const source = newest(join(core, 'src'), (n) => COMPILED.test(n) && !NOT_COMPILED.test(n));
  if (source.at > stamp) {
    return (
      `packages/textscene-core/dist predates ${relative(core, source.file)} — ${what} would ` +
      `report the PREVIOUS revision's registries. Run \`${BUILD}\`.`
    );
  }
  return null;
}
