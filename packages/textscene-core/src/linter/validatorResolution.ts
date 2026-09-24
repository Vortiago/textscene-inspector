/**
 * The resolution walk of `ValidatorRegistry`: removals and validators resolved
 * in one pass up the base chain, exact key before wildcard at every hop. It is
 * the linter's hottest path, so it reads the tables by reference and allocates
 * nothing on a miss.
 */

import type { PropertyValidator } from './propertyValidator.js';
import { MAX_BASE_CHAIN_HOPS } from '../godot/nodeBaseTypes.js';
import { unavailableValidator, type Removal } from './unavailableKey.js';
import {
  matchesIndexedKey,
  matchesIndexedSubtree,
  matchesTerminalIndex,
  type WildcardEntry,
} from './wildcardIndex.js';

/** What the registry stores, as the walks read it. The maps are the registry's own. */
export interface RegistryTables {
  readonly validators: ReadonlyMap<string, Record<string, PropertyValidator>>;
  readonly unavailable: ReadonlyMap<string, Record<string, Removal>>;
  readonly wildcards: ReadonlyMap<string, WildcardEntry[]>;
  /** The declared base of a type, or `undefined` at the top of the chain. */
  baseOf(type: string): string | undefined;
}

/**
 * Walk `nodeType` and its bases: at each hop a removal wins, then the type's
 * own exact-or-wildcard validator; a removal is not inherited past a
 * descendant that re-declares the key.
 */
export function resolveDeclaration(
  tables: RegistryTables,
  nodeType: string,
  propertyKey: string
): PropertyValidator | null {
  // A hop counter, not a visited Set, which allocates on every call. ClassDB
  // ancestry is acyclic, so the bound only stops a malformed hand-built
  // registry from spinning.
  let type: string | undefined = nodeType;
  for (let hops = 0; type !== undefined && hops < MAX_BASE_CHAIN_HOPS; hops++) {
    const removals = tables.unavailable.get(type);
    const removal =
      removals && Object.prototype.hasOwnProperty.call(removals, propertyKey)
        ? removals[propertyKey]
        : undefined;
    if (removal !== undefined) return unavailableValidator(nodeType, removal);

    // Checked after the removal at the same hop, and before moving up: a
    // removal is not inherited past a descendant that re-declares the key.
    const validator = findOwnValidator(tables, type, propertyKey);
    if (validator) return validator;

    type = tables.baseOf(type);
  }
  return null;
}

/**
 * Exact-then-wildcard lookup among a single type's own validators. The four
 * wildcard shapes live in `wildcardIndex.ts`, settled at registration as
 * `entry.kind`.
 */
function findOwnValidator(
  tables: RegistryTables,
  nodeType: string,
  propertyKey: string
): PropertyValidator | null {
  const nodeValidators = tables.validators.get(nodeType);
  if (!nodeValidators) {
    return null;
  }

  // `hasOwnProperty`, not a bare index: a node carrying `toString = 5` would
  // otherwise resolve `Object.prototype.toString` and report its return value
  // in place of a ParseError.
  if (Object.prototype.hasOwnProperty.call(nodeValidators, propertyKey)) {
    const exact = nodeValidators[propertyKey];
    if (exact) return exact;
  }

  // The list holds only wildcards with their prefixes already sliced, so a
  // miss walks a short array and allocates nothing.
  const wildcards = tables.wildcards.get(nodeType);
  if (wildcards === undefined) return null;
  for (const entry of wildcards) {
    let matches: boolean;
    switch (entry.kind) {
      case 'path':
        matches = propertyKey.startsWith(entry.prefix);
        break;
      case 'indexedLeaf':
        matches = matchesIndexedKey(propertyKey, entry.prefix);
        break;
      case 'indexedSubtree':
        matches = matchesIndexedSubtree(propertyKey, entry.prefix);
        break;
      // Named rather than defaulted, so a fifth `WildcardKind` fails to
      // compile here instead of silently inheriting terminal-index matching.
      case 'indexedTerminal':
        matches = matchesTerminalIndex(propertyKey, entry.prefix);
        break;
    }
    if (matches) return entry.validator;
  }

  return null;
}
