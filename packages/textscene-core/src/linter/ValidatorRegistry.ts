/**
 * Storage and public surface of the property validators the strict TSCN parser runs. What it resolves to lives beside
 * it and is re-exported here: `propertyValidator.ts` (what a validator declares), `wildcardIndex.ts` (the two wildcard key
 * shapes Godot writes) and `unavailableKey.ts` (a key a type takes away from its base). The resolution walk is in
 * `validatorResolution.ts`, and the removal rules are in `removalKeys.ts`.
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
   * indexing answers the `Object` function for `type="constructor"`, which then
   * travels as a `string` through every walk below.
   */
  private baseOf(type: string): string | undefined {
    return Object.hasOwn(this.baseTypes, type) ? this.baseTypes[type] : undefined;
  }

  /**
   * Register multiple validators for a node type
   * @param nodeType - TSCN node type (for example "MeshInstance3D")
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
   * Declare that `nodeType` removes properties its base chain declares. `removalKeys.ts` says what makes a key a
   * removal rather than an inert one.
   *
   * @param nodeType - the concrete type that cannot carry the properties.
   * @param removals - property key → `{ reason, cite }`: `reason` is the diagnostic's text, and `cite` is the
   *   `file:line` of the guard that refuses the write (ADR-0032).
   */
  registerUnavailable(nodeType: string, removals: Record<string, Removal>): void {
    refuseOverlap(nodeType, Object.keys(removals), this.validators, 'declares');
    if (!this.unavailable.has(nodeType)) {
      this.unavailable.set(nodeType, {});
    }
    Object.assign(this.unavailable.get(nodeType)!, removals);
  }

  /** Every removal declared directly on `nodeType`, for the grounding guard. */
  getOwnRemovals(nodeType: string): Record<string, Removal> {
    return this.unavailable.get(nodeType) ?? {};
  }

  /**
   * @internal Like {@link ValidatorRegistry.typesWithRegistrations}, this lists the registry without naming a type, which
   * is `registryPopulation.ts`'s job alone. Types declaring a removal are not a subset of `registeredTypes('declaring')`:
   * `HBoxContainer` only takes `vertical` away and registers no validator, so a scan of the validator map misses it.
   */
  getTypesWithRemovals(): string[] {
    return [...this.unavailable.keys()];
  }

  /**
   * Keys `nodeType` removes, declared here or inherited, resolved as `findValidator` resolves them so a sheet's
   * "unavailable" list never holds a key the linter accepts: a removal wins at the hop that declares it, and a nearer
   * type re-declaring the key takes it back.
   */
  getUnavailableKeys(nodeType: string): string[] {
    return unavailableKeysOf(this.tables, nodeType);
  }

  /**
   * The validator for a property, the owner type first and then each base in
   * turn (`validatorResolution.ts`).
   *
   * @returns Something to call, or null if neither the type nor its bases match.
   *   Deliberately untagged: see {@link ValidatorFn}. A caller introspecting a
   *   declaration asks {@link ValidatorRegistry.declarationFor} instead.
   */
  declarationFor(nodeType: string, propertyKey: string): PropertyValidator | null {
      return resolveDeclaration(this.tables, nodeType, propertyKey);
    }

  /**
   * The same resolution, as something to call. A `PropertyValidator` is a `ValidatorFn` with tags, so the narrowing needs
   * no assertion. Running a validator needs no tags, and reading one is introspection for a guard: keeping them apart at
   * the type level stops a hand-assembled roots-only population, since `findValidator(...).intSlot` does not type-check.
   */
  findValidator(nodeType: string, propertyKey: string): ValidatorFn | null {
    return this.declarationFor(nodeType, propertyKey);
  }

  /**
   * The chain `findValidator` walks above `nodeType`, nearest first. A guard about inheritance asks this rather than
   * import a table that may not be the walk's own: a node-only table misses `QuadMesh` shadowing `PlaneMesh`.
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
   * Node types that have validators registered.
   *
   * @internal `registryPopulation.ts` is the only caller: listing the registry without naming a type is its job alone,
   * so no guard assembles the roots-only population by hand.
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
 * The ValidatorRegistry, wired with Godot's real node and resource ancestry (classBaseTypes.ts), so every subclass
 * inherits its base validators.
 */
export const validatorRegistry = new ValidatorRegistry(CLASS_BASE_TYPES);
