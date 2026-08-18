/**
 * Registry for property validators used by strict TSCN parser
 *
 * The registry is the storage and the resolution order; the three things it
 * resolves TO live beside it — `propertyValidator.ts` (what a validator is and
 * declares), `wildcardIndex.ts` (the two wildcard key shapes Godot writes) and
 * `unavailableKey.ts` (a key a type takes away from its base). All three are
 * re-exported here, so no importer moves.
 */

import { CLASS_BASE_TYPES } from './classBaseTypes.js';
import type { PropertyValidator } from './propertyValidator.js';
import { buildWildcardIndex, matchesIndexedKey, type WildcardEntry } from './wildcardIndex.js';
import { unavailableValidator, type Removal } from './unavailableKey.js';

export type { PropertyValidator } from './propertyValidator.js';
export type { Removal } from './unavailableKey.js';

/**
 * How many base-chain hops `findValidator` will walk before giving up.
 *
 * Godot's deepest ancestry is a dozen or so; 32 is slack enough to never bind in
 * practice while still terminating on a malformed hand-built registry.
 */
const MAX_BASE_CHAIN_HOPS = 32;

/**
 * Registry for property validators by node type
 */
export class ValidatorRegistry {
  private validators = new Map<string, Record<string, PropertyValidator>>();
  private unavailable = new Map<string, Record<string, Removal>>();
  /** Wildcard patterns per type, prefixes pre-sliced. Rebuilt on every registerAll. */
  private wildcards = new Map<string, WildcardEntry[]>();

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
    if (!this.validators.has(nodeType)) {
      this.validators.set(nodeType, {});
    }
    const own = this.validators.get(nodeType)!;
    Object.assign(own, validators);
    this.wildcards.set(nodeType, buildWildcardIndex(own));
  }

  /**
   * Declare that `nodeType` REMOVES properties its base chain declares.
   *
   * The base-walk can only ever widen what a leaf accepts, so a class that
   * takes strictly less than its parent cannot be expressed by registering a
   * validator: whatever it registers still reads as "this key is allowed here".
   * `HBoxContainer` inherits `vertical` from `BoxContainer` and then fixes the
   * orientation, so `set_vertical` is `ERR_FAIL_COND_MSG(is_fixed, …)` AND
   * `_validate_property` clears the key to `PROPERTY_USAGE_NONE`.
   *
   * The setter guard is what makes it a removal. `_validate_property` alone is
   * not: it hides a key from the inspector and the saver while the setter still
   * accepts the write, so the value is inert rather than invalid and the key
   * stays inherited. `SpinBox.exp_edit` (spin_box.cpp:648, against
   * `Range::set_exp_ratio`'s unconditional assign at range.cpp:433) and
   * `FileDialog.dialog_text` are both that second shape, and neither is
   * registered as a removal.
   *
   * Modelling it as removal rather than as a rejecting validator is what lets
   * `getOwnKeys` leave the key out (it is not a declaration), the generated
   * sheet render it as unavailable rather than listing a forbidden key under
   * "Accepts", and the shadow guard stop carrying allowlist entries for what is
   * not a shadow.
   *
   * @param nodeType - the concrete type that cannot carry the properties.
   * @param removals - property key → `{ reason, cite }`. A removal rejects every
   *   value of a key a scene may legitimately contain, so it makes the same kind
   *   of claim a bound does and carries the same kind of citation (ADR-0032).
   *   `reason` is phrased for a scene author and used verbatim in the diagnostic;
   *   `cite` is the `file:line` of the guard that refuses the write.
   */
  registerUnavailable(nodeType: string, removals: Record<string, Removal>): void {
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
   * Types declaring a removal, which is NOT a subset of
   * `getRegisteredNodeTypes()`: `HBoxContainer` only takes `vertical` away and
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
    const keys = new Set<string>();
    const reDeclared = new Set<string>();
    const visited = new Set<string>();
    let type: string | undefined = nodeType;
    while (type && !visited.has(type)) {
      visited.add(type);
      for (const key of Object.keys(this.unavailable.get(type) ?? {})) {
        if (!reDeclared.has(key)) keys.add(key);
      }
      // Added after this hop's removals, so a type that both removes and
      // declares a key still reports it removed, as findValidator does.
      for (const key of Object.keys(this.validators.get(type) ?? {})) reDeclared.add(key);
      type = this.baseOf(type);
    }
    return [...keys];
  }

  /**
   * Find a validator for a property, walking the node's base-class chain.
   *
   * The owner type is consulted first (exact match, then `*` wildcards), then
   * each base type in turn (Node3D/Node2D/Control → Node), so a subclass that
   * registers no validator of its own still inherits its base's — the subclass
   * always wins on a key both define. Supports wildcard patterns at every level
   * (e.g. "surface_material_override/*", "theme_override_colors/*").
   *
   * @param nodeType - TSCN node type
   * @param propertyKey - Property key to validate
   * @returns Validator function or null if neither the type nor its bases match
   */
  findValidator(nodeType: string, propertyKey: string): PropertyValidator | null {
    // A hop counter, not a visited Set: this runs for every property of every
    // node, and the Set was an allocation on every call including every miss.
    // The table is derived from ClassDB ancestry, so it is acyclic by
    // construction; the bound only stops a malformed hand-built registry from
    // spinning, which is what the Set was really guarding.
    let type: string | undefined = nodeType;
    for (let hops = 0; type !== undefined && hops < MAX_BASE_CHAIN_HOPS; hops++) {

      // Removals and validators resolve in ONE walk: this is the hottest path
      // in the linter, reached for every property of every node.
      const removals = this.unavailable.get(type);
      const removal =
        removals && Object.prototype.hasOwnProperty.call(removals, propertyKey)
          ? removals[propertyKey]
          : undefined;
      if (removal !== undefined) return unavailableValidator(nodeType, removal);

      // Checked after the removal at the SAME hop, and before moving up: a
      // removal is not inherited past a descendant that re-declares the key.
      const validator = this.findOwnValidator(type, propertyKey);
      if (validator) return validator;

      type = this.baseOf(type);
    }
    return null;
  }

  /**
   * Exact-then-wildcard lookup among a single type's own validators.
   *
   * Two wildcard shapes, because Godot writes two:
   *
   * - `bones/*` matches `bones/0/position`. A literal `/` follows the prefix.
   * - `item_#/*` matches `item_0/text`. Godot's `PropertyListHelper` builds these
   *   as `vformat("%s%d/%s", prefix, i, name)` (`property_list_helper.cpp:149`),
   *   gluing the index straight onto the prefix with no separator, so the first
   *   shape can never match one. `PopupMenu`, `ItemList`, `OptionButton`,
   *   `MenuButton` and `TabBar` all use it.
   */
  private findOwnValidator(nodeType: string, propertyKey: string): PropertyValidator | null {
    const nodeValidators = this.validators.get(nodeType);
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
    const wildcards = this.wildcards.get(nodeType);
    if (wildcards === undefined) return null;
    for (const entry of wildcards) {
      const matches = entry.indexed
        ? matchesIndexedKey(propertyKey, entry.prefix)
        : propertyKey.startsWith(entry.prefix);
      if (matches) return entry.validator;
    }

    return null;
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
   * Node types that currently have validators registered
   */
  getRegisteredNodeTypes(): string[] {
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
