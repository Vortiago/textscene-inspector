/** Where the catalog is written, and where the ClassDB enumeration script lives. */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT } from '../../repoRoot.mjs';

const here = dirname(fileURLToPath(import.meta.url));

export const CATALOG_OUT = join(here, '../node-catalog.json');

/**
 * Every Node class's own serialised properties, from a running ClassDB. A file
 * apart from the catalog, since no catalog reader wants these rows, and
 * `--links-only` refreshes the catalog with no engine.
 */
export const PROPS_OUT = join(here, '../node-properties.json');

/**
 * The same rows for every Resource class, from the same engine run. A file apart
 * from `PROPS_OUT`, since `enginePropertyCoverage` pins an exact ledger against
 * the node table.
 */
export const RESOURCE_PROPS_OUT = join(here, '../resource-properties.json');

/**
 * Resource class to immediate base, ending at Resource. The catalog's `chain`
 * covers instantiable classes only, but the classes that declare the properties
 * are abstract. One hop per class is what the walk reads.
 */
export const RESOURCE_BASES_OUT = join(here, '../resource-bases.json');

/**
 * What a fresh Resource answers, from the same engine run: each typed
 * collection's prefix, which the binary loader takes from the getter, and each
 * stored property declared as a Variant, whose Nil the text saver keeps.
 */
export const RESOURCE_GETTERS_OUT = join(here, '../resource-getters.json');

/** Every ClassDB class: its immediate base, whether it can be instantiated, and whether it is editor API. */
export const CLASSES_OUT = join(here, '../classdb-classes.json');
/** Each stored Node property's default, the overrides of instantiable classes, and the derived properties. */
export const NODE_DEFAULTS_OUT = join(here, '../node-defaults.json');

/** Each Node property whose setter or getter is not `set_` or `get_` and its own name. */
export const PROPERTY_METHODS_OUT = join(here, '../node-property-methods.json');

export const ENUM_GD = join(REPO_ROOT, 'scripts/godot-ref/enumerate-nodes.gd');
