/**
 * The check plan for changed files on disk: `planChecks` with the readers of the negative
 * fixtures and the tests beside each file.
 */

import { readTestsBeside } from './colocatedTests.mjs';
import { isNegativeFixture } from './negativeFixtures.mjs';
import { planChecks, STATIC_GATE } from './prePushPlan.mjs';

/**
 * The commands for `files`, the changed and deleted paths. Undefined `files` means the base of the
 * change is unknown, so the plan runs the static checks over the whole repository.
 */
export function planForFiles(files) {
  return files === undefined
    ? STATIC_GATE
    : planChecks({ ...files, isNegativeFixture, testsBeside: readTestsBeside });
}
