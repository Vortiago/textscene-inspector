/** Where the catalog is written, and where the ClassDB enumeration script lives. */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT } from '../../repoRoot.mjs';

const here = dirname(fileURLToPath(import.meta.url));

export const OUT = join(here, '../node-catalog.json');

/**
 * Every Node class's own serialised properties, from a running ClassDB. A file
 * apart from the catalog, since no catalog reader wants these rows, and
 * `--links-only` refreshes the catalog with no engine.
 */
export const PROPS_OUT = join(here, '../node-properties.json');

/**
 * The same rows for every Resource class, from the same engine run. A file apart
 * from `PROPS_OUT`, since `enginePropertyCoverage` pins an exact ledger against
 * the node table. Only `hintImplementationParity` reads both.
 */
export const RESOURCE_PROPS_OUT = join(here, '../resource-properties.json');

/**
 * Resource class to immediate base, ending at Resource. The catalog's `chain`
 * covers instantiable classes only, but the classes that declare the properties
 * are abstract. One hop per class is what the walk reads.
 */
export const RESOURCE_BASES_OUT = join(here, '../resource-bases.json');
export const ENUM_GD = join(REPO_ROOT, 'scripts/godot-ref/enumerate-nodes.gd');
