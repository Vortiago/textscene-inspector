/**
 * The one place the preview harness resolves the repo layout, so moving a sibling module cannot
 * repoint a path at the wrong tree.
 */

import { join } from 'node:path';
import { REPO_ROOT } from '../../repoRoot.mjs';

export { REPO_ROOT };
export const WEB_DIST_INDEX = join(REPO_ROOT, 'apps/textscene-web/dist/index.html');
