/**
 * The resolution walk of `ValidatorRegistry`: removals and validators resolved
 * in ONE pass up the base chain, exact key before wildcard at every hop.
 *
 * This is the hottest path in the linter, reached for every property of every
 * node, so it takes the registry's tables by reference and allocates nothing
 * on a miss.
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
  // A hop counter, not a visited Set: this runs for every property of every
  // node, and the Set was an allocation on every call including every miss.
  // The table is derived from ClassDB ancestry, so it is acyclic by
  // construction; the bound only stops a malformed hand-built registry from
  // spinning, which is what the Set was really guarding.
  let type: string | undefined = nodeType;
  for (let hops = 0; type !== undefined && hops < MAX_BASE_CHAIN_HOPS; hops++) {

    // Removals and validators resolve in ONE walk: this is the hottest path
    // in the linter, reached for every property of every node.
    const removals = tables.unavailable.get(type);
    const removal =
      removals && Object.prototype.hasOwnProperty.call(removals, propertyKey)
        ? removals[propertyKey]
        : undefined;
    if (removal !== undefined) return unavailableValidator(nodeType, removal);

    // Checked after the removal at the SAME hop, and before moving up: a
    // removal is not inherited past a descendant that re-declares the key.
    const validator = findOwnValidator(tables, type, propertyKey);
    if (validator) return validator;

    type = tables.baseOf(type);
  }
  return null;
}

/**
 * Exact-then-wildcard lookup among a single type's own validators.
 *
 * Four wildcard shapes, spelled out in `wildcardIndex.ts`. Which one a
 * registration is is settled at registration time and read here as
 * `entry.kind`, so a miss walks a short array and allocates nothing.
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

  // Exact match first. `hasOwnProperty`, not a bare index: a node carrying
  // `toString = 5` would otherwise resolve `Object.prototype.toString`, which
  // is truthy, and the caller would push its return value into the diagnostic
  // list in place of a ParseError.
  if (Object.prototype.hasOwnProperty.call(nodeValidators, propertyKey)) {
    const exact = nodeValidators[propertyKey];
    if (exact) return exact;
  }

  // Then the wildcards, over a list that holds ONLY wildcards with their
  // prefixes already sliced, so a miss walks a short array and allocates
  // nothing.
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
