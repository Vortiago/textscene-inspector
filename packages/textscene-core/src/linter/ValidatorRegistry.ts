/**
 * Registry for property validators used by strict TSCN parser
 */

import type { ParseError } from './types.js';
import { propertyError } from './validators/propertyError.js';
import { NODE_BASE_TYPES } from './nodeBaseTypes.js';

/**
 * Property validator function
 * @param key - Property key
 * @param value - Property value (raw string)
 * @param line - Line number in source file
 * @returns ParseError if validation fails, null if valid
 */
export type PropertyValidator = ((
  key: string,
  value: string,
  line: number
) => ParseError | null) & {
  /**
   * What this validator accepts, in one short human phrase — `float 0–1`,
   * `enum 0–3 (OFF/ON/…)`, `Vector3(x, y, z)`, `32-bit layer mask`.
   *
   * A validator is otherwise an opaque closure, so the generated `## Linting`
   * table could only list property NAMES and a reader had no way to see the
   * bounds. The `v` DSL knows them at construction time, so it tags them here
   * and `lintCoverage.mjs` renders them. Untagged validators simply render
   * blank rather than being guessed at.
   */
  accepts?: string;

  /**
   * True when the ONLY thing this validator rejects is a value Godot's own
   * parser could not read either — `Color(1, 1)`, `not-a-float`, an unquoted
   * string. Such a rejection needs no citation, because no `.tscn` the engine
   * loads carries the value.
   *
   * It is a positive declaration rather than an inference: a validator with
   * neither this flag nor `grounding` is one nobody has classified, and
   * `boundGrounding.test.ts` fails on it. That is what stops a hand-rolled
   * validator from rejecting real values with nothing behind it — the failure
   * mode that let `GPUParticles3D.visibility_aabb` reject an extent Godot
   * assigns unaltered.
   */
  formatOnly?: boolean;

  /**
   * The per-sub-property validators a WILDCARD dispatcher forwards to.
   *
   * A key like `angular_limit_x/*` registers one dispatcher, and the sweep sees
   * only that function: tagging it satisfies the guard while an ungrounded leaf
   * sits behind it, checking `upper_angle` against a bound nobody verified.
   * Exposing the leaves is what lets the sweep recurse past the dispatcher.
   */
  leaves?: readonly PropertyValidator[];

  /**
   * Why the bound is the bound (ADR-0032), with the governing `file:line`.
   * `enforced` = Godot's setter refuses or alters the value, so out of range is
   * an error. `hinted` = only the PROPERTY_HINT_RANGE says so, so it is a
   * warning. Absent means the bound has not been audited yet.
   */
  grounding?: { kind: 'enforced' | 'hinted'; cite: string };
};

/**
 * Whether `key` is `<prefix><digits>/<leaf>`, the shape Godot's
 * `PropertyListHelper` writes for an indexed property array.
 *
 * Mirrors the engine's own parse (`property_list_helper.cpp:47-55`): split at the
 * LAST `/`, require the head to start with the prefix, and require what follows
 * the prefix to be a valid integer. Done with `lastIndexOf` and a char scan
 * rather than `split`, because `findOwnValidator` runs for every property of
 * every node and a miss must not allocate.
 *
 * A negative index is rejected, matching `_get_property`'s `index < 0` guard: a
 * `.tscn` cannot address item -1, so `item_-1/text` is not a key Godot reads.
 */
/**
 * How many base-chain hops `findValidator` will walk before giving up.
 *
 * Godot's deepest ancestry is a dozen or so; 32 is slack enough to never bind in
 * practice while still terminating on a malformed hand-built registry.
 */
const MAX_BASE_CHAIN_HOPS = 32;

/**
 * A wildcard registration with its prefix already sliced off the pattern.
 *
 * The prefix used to be re-derived on every lookup (`pattern.slice(0, -2) + '/'`,
 * two allocations per candidate) and a miss is the common case, so the work
 * landed on the hot path for every unregistered property of every node. Slicing
 * once at registration makes the lookup a `startsWith` against a retained
 * string. It also lets the loop skip EXACT keys entirely: `Control` registers
 * far more of those than the six `theme_override_*` wildcards every Control
 * descendant inherits.
 */
interface WildcardEntry {
  /** `bones/` for `bones/*`, `item_` for `item_#/*`. */
  prefix: string;
  /** True for the `#/*` shape, whose index is glued to the prefix. */
  indexed: boolean;
  validator: PropertyValidator;
}

/** Extract the wildcard patterns from a type's own validators, prefixes pre-sliced. */
function buildWildcardIndex(own: Record<string, PropertyValidator>): WildcardEntry[] {
  const entries: WildcardEntry[] = [];
  for (const pattern in own) {
    if (!pattern.endsWith('/*')) continue;
    const validator = own[pattern];
    if (!validator) continue;
    const indexed = pattern.endsWith('#/*');
    entries.push({
      prefix: indexed ? pattern.slice(0, -3) : pattern.slice(0, -2) + '/',
      indexed,
      validator,
    });
  }
  return entries;
}

function matchesIndexedKey(key: string, prefix: string): boolean {
  if (!key.startsWith(prefix)) return false;
  const slash = key.lastIndexOf('/');
  // The leaf must be non-empty, and the index must sit between the two.
  if (slash <= prefix.length || slash === key.length - 1) return false;

  // A LEADING SIGN IS PART OF THE INDEX, matching `String::is_valid_int()`,
  // which is what the engine tests before it looks at the value
  // (property_list_helper.cpp:52-58: `is_valid_int()` first, THEN `index < 0`).
  // Rejecting the sign here instead routed `item_-1/text` to no validator at
  // all, so the dispatcher's negative-index diagnostic could never fire and a
  // key Godot silently drops was reported clean.
  let i = prefix.length;
  const first = key.charCodeAt(i);
  if (first === 45 || first === 43) i++;
  if (i === slash) return false; // a sign with no digits is not an int
  for (; i < slash; i++) {
    const code = key.charCodeAt(i);
    if (code < 48 || code > 57) return false;
  }
  return true;
}

/**
 * A key a concrete type takes away from its base, and the engine guard that
 * takes it away. `reason` reaches the scene author; `cite` is what makes the
 * claim checkable, exactly as `PropertyValidator.grounding` does for a bound.
 */
export interface Removal {
  reason: string;
  /** `file:line` of the guard that refuses the write. */
  cite: string;
}

/**
 * Registry for property validators by node type
 */
export class ValidatorRegistry {
  private validators = new Map<string, Record<string, PropertyValidator>>();
  private unavailable = new Map<string, Record<string, Removal>>();
  /** Wildcard patterns per type, prefixes pre-sliced. Rebuilt on every registerAll. */
  private wildcards = new Map<string, WildcardEntry[]>();

  /**
   * @param baseTypes - node-type → base-type map driving the inheritance walk in
   *   `findValidator` (see nodeBaseTypes.ts). Defaults to `{}` (no inheritance,
   *   pure exact/wildcard matching); the shared singleton wires NODE_BASE_TYPES.
   */
  constructor(private baseTypes: Readonly<Record<string, string>> = {}) {}

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
      type = this.baseTypes[type];
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
    // `NODE_BASE_TYPES` is derived from ClassDB ancestry, so it is acyclic by
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

      type = this.baseTypes[type];
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
 * The validator a removed key resolves to: it rejects every value, because the
 * key's presence is itself the defect. Memoised per (type, reason) so repeated
 * lookups of the same removal return the same function, which keeps identity
 * comparisons in the tests meaningful.
 */
const unavailableValidators = new Map<string, PropertyValidator>();

function unavailableValidator(nodeType: string, removal: Removal): PropertyValidator {
  // The CITE is part of the identity, not just the reason: the validator now
  // records `grounding.cite`, so two removals on one type sharing a reason but
  // citing different lines would otherwise both get whichever was memoised
  // first, and the second would report a citation for the wrong guard.
  const cacheKey = `${nodeType}\u0000${removal.reason}\u0000${removal.cite}`;
  const cached = unavailableValidators.get(cacheKey);
  if (cached) return cached;
  const validator: PropertyValidator = (key, _value, line) =>
    propertyError(
      key,
      line,
      `Property '${key}' cannot be set on ${nodeType}: ${removal.reason}`,
      `UNAVAILABLE_${key.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`
    );
  validator.accepts = 'not available on this type';
  // A removal refuses every value of a key a scene may legitimately carry, so it
  // is a grounded rejection (ADR-0032), not a format check.
  validator.grounding = { kind: 'enforced', cite: removal.cite };
  unavailableValidators.set(cacheKey, validator);
  return validator;
}

/**
 * Singleton instance of ValidatorRegistry, wired with the real node base-type
 * table so every subclass inherits its base validators.
 */
export const validatorRegistry = new ValidatorRegistry(NODE_BASE_TYPES);
