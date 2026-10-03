/** The path case of the extension host's filesystem, read once from the platform the host runs on. */

import { pathCaseOf, type PathCase } from '@textscene/core/resources/resPath';

/** vscode.dev's web worker has no `process`, so its virtual filesystem counts case. */
export const HOST_PATH_CASE: PathCase = pathCaseOf(
  typeof process === 'undefined' ? undefined : process.platform
);
