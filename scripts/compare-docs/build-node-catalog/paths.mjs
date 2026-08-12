/** Where the catalog is written, and where the ClassDB enumeration script lives. */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT } from '../../repoRoot.mjs';

const here = dirname(fileURLToPath(import.meta.url));

export const OUT = join(here, '../node-catalog.json');

/**
 * Every Node class's own serialised properties, straight from a running
 * ClassDB.
 *
 * A separate file from the catalog, not another key in it: the catalog is read
 * by the gallery, the sheet generator, the base-type generator and the coverage
 * ledger, none of which want 160 KB of property rows, and this one has a single
 * consumer. They also go stale together but are refreshed apart, since
 * `--links-only` can refresh the catalog with no engine at all.
 */
export const PROPS_OUT = join(here, '../node-properties.json');

/**
 * The same rows for every Resource class, from the same engine run.
 *
 * A third file rather than more keys in `PROPS_OUT`, for a sharper reason than
 * the one above: `enginePropertyCoverage` pins an exact ledger against the node
 * table, so Resource rows landing there would move a number that answers a
 * question about Nodes. The hierarchies are disjoint, so nothing needs both
 * files merged except `hintImplementationParity`, which is about hints rather
 * than about either hierarchy.
 */
export const RESOURCE_PROPS_OUT = join(here, '../resource-properties.json');
export const ENUM_GD = join(REPO_ROOT, 'scripts/godot-ref/enumerate-nodes.gd');
