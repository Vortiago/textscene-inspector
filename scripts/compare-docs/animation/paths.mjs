/**
 * Where an animated capture reads scenes from and writes GIFs to. Resolved once
 * so a module's own depth never enters the calculation.
 */

import { join } from 'node:path';
import { REPO_ROOT } from '../../repoRoot.mjs';

export { REPO_ROOT };
export const IMAGES = join(REPO_ROOT, 'docs/comparison/images');
