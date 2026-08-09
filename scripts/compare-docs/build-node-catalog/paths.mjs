/** Where the catalog is written, and where the ClassDB enumeration script lives. */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../..');

export const OUT = join(here, '../node-catalog.json');
export const ENUM_GD = join(repoRoot, 'scripts/godot-ref/enumerate-nodes.gd');
