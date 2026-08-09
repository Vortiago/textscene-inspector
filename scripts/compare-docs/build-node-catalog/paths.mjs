/** Where the catalog is written, and where the ClassDB enumeration script lives. */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT } from '../../repoRoot.mjs';

const here = dirname(fileURLToPath(import.meta.url));

export const OUT = join(here, '../node-catalog.json');
export const ENUM_GD = join(REPO_ROOT, 'scripts/godot-ref/enumerate-nodes.gd');
