/**
 * Registry for property validators used by strict TSCN parser
 *
 * The registry is the storage and the resolution order; the three things it
 * resolves TO live beside it — `propertyValidator.ts` (what a validator is and
 * declares), `wildcardIndex.ts` (the two wildcard key shapes Godot writes) and
 * `unavailableKey.ts` (a key a type takes away from its base). All three are
 * re-exported here, so no importer moves. The resolution walk lives in
 * `validatorResolution.ts` and the removal rules in `removalKeys.ts`; this file
 * is the storage and the public surface.
 */

import { CLASS_BASE_TYPES } from '../godot/classBaseTypes.js';
import { MAX_BASE_CHAIN_HOPS } from '../godot/nodeBaseTypes.js';
import type { PropertyValidator, ValidatorFn } from './propertyValidator.js';
import { buildWildcardIndex, type WildcardEntry } from './wildcardIndex.js';
import type { Removal } from './unavailableKey.js';
import { resolveDeclaration, type RegistryTables } from './validatorResolution.js';
import { refuseOverlap, unavailableKeysOf } from './removalKeys.js';

export type { PropertyValidator, ValidatorFn } from './propertyValidator.js';
export type { Removal } from './unavailableKey.js';

/**
 * Registry for property validators by node type
 */
export class ValidatorRegistry {
  private validators = new Map<string, Record<string, PropertyValidator>>();
  private unavailable = new Map<string, Record<string, Removal>>();
  /** Wildcard patterns per type, prefixes pre-sliced. Rebuilt on every registerAll. */
  private wildcards = new Map<string, WildcardEntry[]>();
  /** The three maps and the base lookup, built once: the walks run per property and allocate nothing. */
  private readonly tables: RegistryTables = {
    validators: this.validators,
    unavailable: this.unavailable,
    wildcards: this.wildcards,
    baseOf: (type) => this.baseOf(type),
  };

  /**
   * @param baseTypes - class → base-type map driving the inheritance walk in
   *   `findValidator` (see classBaseTypes.ts). Defaults to `{}` (no inheritance,
   *   pure exact/wildcard matching); the shared singleton wires the real one.
   */
  constructor(private baseTypes: Readonly<Record<string, string>> = {}) {}

  /**
   * The declared base of `type`, or `undefined`.
   *
   * `Object.hasOwn`, because the key is a node type the `.tscn` chooses: bare
   * indexing answers the `Object` FUNCTION for `type="constructor"`, which then
   * travels as a `string` through every walk below.
   */
  private baseOf(type: string): string | undefined {
    return Object.hasOwn(this.baseTypes, type) ? this.baseTypes[type] : undefined;
  }

  /**
   * Register multiple validators for a node type
   * @param nodeType - TSCN node type (e.g., "MeshInstance3D")
   * @param validators - Map of property keys to validator functions
   */
  registerAll(nodeType: string, validators: Record<string, PropertyValidator>): void {
    refuseOverlap(nodeType, Object.keys(validators), this.unavailable, 'removes');
    if (!this.validators.has(nodeType)) {
      this.validators.set(nodeType, {});
    }
    const own = this.validators.get(nodeType)!;
    Object.assign(own, validators);
    this.wildcards.set(nodeType, buildWildcardIndex(own));
  }

  /**
   * Declare that `nodeType` REMOVES properties its base chain declares — see
   * `removalKeys.ts` for what makes a key a removal rather than an inert one.
   *
   * @param nodeType - the concrete type that cannot carry the properties.
   * @param removals - property key → `{ reason, cite }`; `reason` is used
   *   verbatim in the diagnostic, `cite` is the `file:line` of the guard that
   *   refuses the write (ADR-0032).
   */
  registerUnavailable(nodeType: string, removals: Record<string, Removal>): void {
    refuseOverlap(nodeType, Object.keys(removals), this.validators, 'declares');
    if (!this.unavailable.has(nodeType)) {
      this.unavailable.set(nodeType, {});
    }
    Object.assign(this.unavailable.get(nodeType)!, removals);
  }

  /** Every removal declared directly on `nodeType`, for the grounding sweep. */
  getOwnRemovals(nodeType: string): Record<string, Removal> {
    return this.unavailable.get(nodeType) ?? {};
  }

  /**
   * @internal — like {@link ValidatorRegistry.typesWithRegistrations}, this
   * enumerates what the registry holds without naming a type, which is
   * `registryPopulation.ts`'s alone. A discipline enforced on one of two
   * equivalent doors is one the next author walks around without noticing.
   *
   * Types declaring a removal, which is NOT a subset of
   * `registeredTypes('declaring')`: `HBoxContainer` only takes `vertical` away and
   * registers no validator of its own, so it appears in `unavailable` alone. A
   * sweep over the validator map misses every such type entirely.
   */
  getTypesWithRemovals(): string[] {
    return [...this.unavailable.keys()];
  }

  /**
   * Keys `nodeType` removes, whether declared here or inherited.
   *
   * Resolved the same way `findValidator` resolves them, because the two answer
   * one question and a disagreement would put a key in a sheet's "unavailable"
   * list while the linter still accepted it: a removal wins at the hop that
   * declares it, but a NEARER type re-declaring the key takes it back.
   */
  getUnavailableKeys(nodeType: string): string[] {
    return unavailableKeysOf(this.tables, nodeType);
  }

  /**
   * The validator for a property, the owner type first and then each base in
   * turn (`validatorResolution.ts`).
   *
   * @returns Something to CALL, or null if neither the type nor its bases match.
   *   Deliberately untagged: see {@link ValidatorFn}. A caller introspecting a
   *   declaration asks {@link ValidatorRegistry.declarationFor} instead.
   */
  declarationFor(nodeType: string, propertyKey: string): PropertyValidator | null {
      return resolveDeclaration(this.tables, nodeType, propertyKey);
    }

  /**
   * The same resolution, as something to CALL.
   *
   * A `PropertyValidator` is a `ValidatorFn` with tags, so narrowing needs no
   * assertion — the walk above returns the wide type and this hands back the
   * narrow one. Two questions share one walk and differ only in what the caller
   * may then read: running a validator needs no tags, and reading a tag is
   * introspection that belongs to a sweep. Keeping them apart at the type level
   * is what stops a hand-assembled roots-only population from compiling —
   * `findValidator(...).intSlot` does not type-check.
   */
  findValidator(nodeType: string, propertyKey: string): ValidatorFn | null {
    return this.declarationFor(nodeType, propertyKey);
  }

  /**
   * The chain `findValidator` walks above `nodeType`, nearest first.
   *
   * Exposed so a guard about inheritance asks the registry what it inherits
   * FROM instead of importing a table and assuming it is the same one: the
   * shadow-copy guard read the node table after this walk had gained Godot's
   * resource ancestry, and `QuadMesh` shadowing `PlaneMesh` read as clean.
   */
  baseChainOf(nodeType: string): string[] {
    const chain: string[] = [];
    let type: string | undefined = this.baseOf(nodeType);
    for (let hops = 0; type !== undefined && hops < MAX_BASE_CHAIN_HOPS; hops++) {
      chain.push(type);
      type = this.baseOf(type);
    }
    return chain;
  }

  /**
   * Node types that currently have validators registered.
   *
   * @internal — `registryPopulation.ts` is the only caller. Enumerating what the
   * registry holds WITHOUT naming a type is that module's alone; reaching this
   * directly is how a sweep comes to assemble the roots-only population by hand.
   */
  typesWithRegistrations(): string[] {
    return [...this.validators.keys()];
  }

  /**
   * Keys registered directly under `nodeType` (own registration only, no
   * base-walk). Used by the meta-guard test to detect shadow copies.
   */
  getOwnKeys(nodeType: string): string[] {
    const own = this.validators.get(nodeType);
    return own ? Object.keys(own) : [];
  }

  /**
   * Clear all registered validators (useful for testing)
   */
  clear(): void {
    this.validators.clear();
    this.unavailable.clear();
    this.wildcards.clear();
  }
}

/**
 * Singleton instance of ValidatorRegistry, wired with Godot's real ancestry —
 * node and resource alike (classBaseTypes.ts) — so every subclass inherits its
 * base validators.
 */
export const validatorRegistry = new ValidatorRegistry(CLASS_BASE_TYPES);
