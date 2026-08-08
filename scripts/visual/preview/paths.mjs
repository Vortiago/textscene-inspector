/**
 * The one place the preview harness resolves the repo layout. Every sibling
 * imports from here rather than deriving its own `import.meta.url` offset: the
 * depth is then a property of this file alone, and moving a module cannot
 * silently repoint a path at the wrong tree.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(here, '../../..');
export const WEB_DIST_INDEX = join(REPO_ROOT, 'apps/textscene-web/dist/index.html');
