/**
 * Where an animated capture reads scenes from and writes GIFs to. Resolved once
 * so a module's own depth never enters the calculation.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(here, '../../..');
export const IMAGES = join(REPO_ROOT, 'docs/comparison/images');
