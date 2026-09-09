/**
 * The one place the preview harness resolves the repo layout. Every sibling
 * imports from here rather than deriving its own `import.meta.url` offset: the
 * depth is then a property of this file alone, and moving a module cannot
 * silently repoint a path at the wrong tree.
 */

import { join } from 'node:path';
import { REPO_ROOT } from '../../repoRoot.mjs';

export { REPO_ROOT };
export const WEB_DIST_INDEX = join(REPO_ROOT, 'apps/textscene-web/dist/index.html');
