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

import { existsSync, readFileSync, statSync } from 'node:fs';
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
  const built = newest(join(core, 'dist'), (n) => n.endsWith('.js'));
  if (built.failed) {
    return `packages/textscene-core/dist could not be read — run \`${BUILD}\`.`;
  }
  if (!built.at) {
    return `packages/textscene-core/dist is not built — run \`${BUILD}\`.`;
  }

  // Against tsc's OWN record of when it last evaluated the project, not against
  // the newest emitted `.js`. An incremental build does not rewrite an output
  // whose content did not change, so a no-op regeneration of a source file
  // (`pnpm nodes:catalog` rewriting nodeBaseTypes.generated.ts byte-identically)
  // left every `.js` older than it and no amount of rebuilding could clear the
  // complaint. A guard whose prescribed remedy does not work gets bypassed.
  const stampPath = join(core, 'tsconfig.tsbuildinfo');
  let stamp;
  let record;
  try {
    stamp = statSync(stampPath).mtimeMs;
    record = JSON.parse(readFileSync(stampPath, 'utf8'));
  } catch {
    return `packages/textscene-core has no readable tsconfig.tsbuildinfo — run \`${BUILD}\`.`;
  }

  // The stamp is WRITTEN BY A BUILD THAT FAILED, so its mtime alone says only
  // that tsc ran. `semanticDiagnosticsPerFile` holds an array for each file tsc
  // recorded errors against, and is empty on a clean build, which makes it the
  // engine's own answer to "did this produce the outputs you are about to
  // measure". Without it, `touch tsconfig.tsbuildinfo` also cleared the
  // complaint outright.
  const failing = (record.semanticDiagnosticsPerFile ?? []).filter(Array.isArray);
  if (failing.length) {
    const first = record.fileNames?.[failing[0][0] - 1] ?? 'a source file';
    return (
      `packages/textscene-core last built with type errors (${first}), so dist is ` +
      `incomplete and ${what} would measure whatever survived. Run \`${BUILD}\`.`
    );
  }

  // A DELETED source bumps no mtime under `src`, so the comparison below cannot
  // see one and a dist still carrying the removed slice's self-registration
  // reads fresh forever. tsc's file list is the record of what the build saw:
  // a name in it that is no longer on disk dates the build exactly.
  const removed = (record.fileNames ?? [])
    .filter((f) => f.startsWith('./src/') && COMPILED.test(f) && !NOT_COMPILED.test(f))
    .find((f) => !existsSync(join(core, f)));
  if (removed) {
    return (
      `packages/textscene-core/dist was built from ${removed}, which no longer exists — ` +
      `${what} would still see what it registered. Run \`${BUILD}\`.`
    );
  }

  const source = newest(join(core, 'src'), (n) => COMPILED.test(n) && !NOT_COMPILED.test(n));
  if (source.failed) {
    return `packages/textscene-core/src could not be walked, so ${what} cannot be trusted.`;
  }
  if (!source.at) {
    return `packages/textscene-core/src has no compiled sources, so ${what} has no subject.`;
  }
  if (source.at > stamp) {
    return (
      `packages/textscene-core/dist predates ${relative(core, source.file)} — ${what} would ` +
      `report the PREVIOUS revision's registries. Run \`${BUILD}\`.`
    );
  }
  return null;
}
