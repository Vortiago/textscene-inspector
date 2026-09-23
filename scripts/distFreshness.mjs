/**
 * Whether `packages/textscene-core/dist` is current enough for a ledger to read.
 * The ledgers measure the built registries, since the barrels' NodeNext `.js`
 * specifiers cannot be imported from source. `pnpm validate` builds first, so
 * this guards the local workflow alone.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { newestMtime } from './newestMtime.mjs';

export const BUILD = 'pnpm --filter @textscene/core build';

/**
 * `tsc` emits `src/**` minus the tests, the test kit and the ambient
 * declarations, mirroring the package tsconfig's `exclude`. An edit to those is
 * not staleness: `tsc --build` no-ops on it, so the prescribed build could not
 * clear the complaint.
 */
const COMPILED = /\.tsx?$/;
const NOT_COMPILED = /\.d\.ts$|\.testkit\.tsx?$|\.(test|spec)\.tsx?$/;

/** Newest kept file under `dir`; `testing/` is the excluded kit, at any depth. */
export const newest = (dir, keep) => newestMtime(dir, keep, (name) => name !== 'testing');

/**
 * An actionable complaint, or `null` when the build is current.
 *
 * @param core - the `packages/textscene-core` directory.
 * @param what - what the caller is about to measure, for the message.
 */
export function stalenessMessage(core, what = 'this ledger') {
  // Unreadable and empty prescribe the same remedy, and an unreadable walk
  // reports `at === 0` anyway, so one branch covers both.
  const built = newest(join(core, 'dist'), (n) => n.endsWith('.js'));
  if (built.failed || !built.at) {
    return `packages/textscene-core/dist is not built — run \`${BUILD}\`.`;
  }

  // Against tsc's own record of its last run, not the newest emitted `.js`: an
  // incremental build leaves an unchanged output untouched, so a byte-identical
  // regeneration of a source would leave a complaint no build could clear.
  const stampPath = join(core, 'tsconfig.tsbuildinfo');
  let stamp;
  let record;
  try {
    stamp = statSync(stampPath).mtimeMs;
    record = JSON.parse(readFileSync(stampPath, 'utf8'));
  } catch {
    return `packages/textscene-core has no readable tsconfig.tsbuildinfo — run \`${BUILD}\`.`;
  }

  // A failed build writes the stamp too, so its mtime says only that tsc ran.
  // `semanticDiagnosticsPerFile` holds an array for each file tsc recorded
  // errors against, and none on a clean build.
  const failing = (record.semanticDiagnosticsPerFile ?? []).find(Array.isArray);
  if (failing) {
    const first = record.fileNames?.[failing[0] - 1] ?? 'a source file';
    return (
      `packages/textscene-core last built with type errors (${first}), so dist is ` +
      `incomplete and ${what} would measure whatever survived. Run \`${BUILD}\`.`
    );
  }

  // `tsc --noEmit` (`pnpm type-check`) writes the same record. Its
  // `affectedFilesPendingEmit` lists files evaluated and not emitted, which a
  // full build leaves empty. An interrupted build leaves it too: also stale.
  if ((record.affectedFilesPendingEmit ?? []).length > 0) {
    return (
      `packages/textscene-core/tsconfig.tsbuildinfo was written by a type-check rather than ` +
      `a build, so dist is older than the stamp and ${what} would measure it. Run \`${BUILD}\`.`
    );
  }

  // A deleted source bumps no mtime under `src`, but a name in tsc's file list
  // that is no longer on disk dates the build.
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

/**
 * The `beforeAll` every dist-reading ledger needs, never at module scope: a
 * throw there during a concurrent `tsc --build` surfaces as a vitest collection
 * error instead of this message.
 */
export function requireFreshDist(core, what = 'this ledger') {
  const stale = stalenessMessage(core, what);
  if (stale) throw new Error(stale);
}
