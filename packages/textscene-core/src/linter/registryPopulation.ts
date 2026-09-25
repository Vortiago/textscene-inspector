/**
 * What the registry holds, as three populations: types, keys and validators. A
 * point lookup on a named type stays the registry's, and the population guard
 * keeps every walk without a named type here. It sits beside `ValidatorRegistry.ts`
 * so a sweep author finds it.
 */

import { validatorRegistry, type ValidatorRegistry } from './ValidatorRegistry.js';
import type { PropertyValidator } from './propertyValidator.js';

/** Which map a registration came from. */
export type KeyKind = 'declaration' | 'removal';

/**
 * One key one type registered, spelled as the registration spells it. Roots
 * only: a leaf is not a registration.
 */
export interface RegisteredKey {
  readonly nodeType: string;
  /**
   * A literal key, or a wildcard pattern (`settings/#/*`). Never a scene key:
   * no `.tscn` contains `*` or `#`.
   */
  readonly key: string;
  readonly kind: KeyKind;
}

/** A validator the sweep reached, and everything about where it was reached. */
export interface Subject {
  /** `Type.key` at a root, plus one `[i]` per `leaves` hop below it. */
  readonly label: string;
  readonly nodeType: string;
  /** The registered pattern the root resolved under, the same at every depth. */
  readonly key: string;
  readonly kind: KeyKind;
  /** 0 at a root. Unbounded: a leaf can itself dispatch. */
  readonly depth: number;
  readonly validator: PropertyValidator;
}

/**
 * A validator to start a walk from, and the label to report it under. It may
 * carry its registration, which `registryRoots` fills in and a fixture usually
 * does not. Declared, so the walk reads it by type, and a root without one
 * leaves the site fields empty.
 */
export interface Root extends Partial<RegisteredKey> {
  readonly label: string;
  readonly validator: PropertyValidator;
}

/** How a walk is scoped and how it refuses to be vacuous. */
export interface WalkOptions {
  /**
   * Walk exactly these instead of the registry's own registrations: the seam a
   * guard uses to prove its bite against scratch validators.
   */
  readonly roots?: readonly Root[];
  /**
   * Walk this registry rather than the live singleton, as both sibling
   * populations allow, so a scratch-registry test needs no hand-built roots.
   */
  readonly registry?: ValidatorRegistry;
  /**
   * Fail below this many validators visited, counted before `keep`: a real
   * sweep's `keep` is an offender filter expecting `[]`. A sweep that forgot
   * `import './index.js'` walks nothing and says so.
   */
  readonly atLeast?: number;
}

/**
 * Types the registry can answer for. `'declaring'` is the validator map's key
 * set, with an empty map (`CheckButton`) but without a removal-only type
 * (`HBoxContainer`). `'answering'` adds the removals. Neither contains the other,
 * so there is no default.
 */
export function registeredTypes(
  scope: 'declaring' | 'answering',
  registry: ValidatorRegistry = validatorRegistry
): readonly string[] {
  const declaring = registry.typesWithRegistrations();
  if (scope === 'declaring') return declaring;
  return [...new Set([...declaring, ...registry.getTypesWithRemovals()])];
}

/**
 * Every key any type registered, declarations then removals, in two walks: a
 * removal-only type never appears in the validator map.
 */
export function registeredKeys(
  registry: ValidatorRegistry = validatorRegistry
): readonly RegisteredKey[] {
  const out: RegisteredKey[] = [];
  for (const nodeType of registry.typesWithRegistrations()) {
    for (const key of registry.getOwnKeys(nodeType)) {
      out.push({ nodeType, key, kind: 'declaration' });
    }
  }
  for (const nodeType of registry.getTypesWithRemovals()) {
    for (const key of Object.keys(registry.getOwnRemovals(nodeType))) {
      out.push({ nodeType, key, kind: 'removal' });
    }
  }
  return out;
}

/**
 * Every validator the registry can run, dispatchers descended; the only function
 * that returns validators. `keep` decides what is reported, never what is
 * descended, so excusing a dispatcher never excuses its subtree.
 */
export function everyValidator(
  keep: (validator: PropertyValidator) => boolean,
  opts: WalkOptions = {}
): readonly Subject[] {
  const roots = opts.roots ?? registryRoots(opts.registry ?? validatorRegistry);
  const out: Subject[] = [];
  let visited = 0;
  /** Validators whose leaves have been walked, by function identity. */
  const seen = new Set<PropertyValidator>();

  const report = (at: Site, validator: PropertyValidator, label: string, depth: number): void => {
    visited++;
    if (keep(validator)) out.push({ ...at, label, depth, validator });
  };
  const descend = (at: Site, validator: PropertyValidator, label: string, depth: number): void => {
    if (seen.has(validator)) return;
    seen.add(validator);
    validator.leaves?.forEach((leaf, index) => {
      if (seen.has(leaf)) return;
      const leafLabel = `${label}[${index}]`;
      report(at, leaf, leafLabel, depth + 1);
      descend(at, leaf, leafLabel, depth + 1);
    });
  };

  // Every root is a subject under its own `(nodeType, key)`, even when its
  // function is shared (`unavailableValidator` memoises on reason and cite). Only
  // the walk into leaves dedupes, by identity, under the first path to reach one.
  for (const root of roots) {
    const at = siteOf(root);
    report(at, root.validator, root.label, 0);
    descend(at, root.validator, root.label, 0);
  }

  if (opts.atLeast !== undefined && visited < opts.atLeast) {
    throw new Error(
      `registry population is ${visited}, below the floor of ${opts.atLeast}. ` +
        `Was the linter barrel imported (\`import './index.js'\`) before the sweep?`
    );
  }
  return out;
}

/** Where a subject was reached from: the registration, not the validator. */
type Site = Pick<Subject, 'nodeType' | 'key' | 'kind'>;

/**
 * A root's registration, or empty for a fixture that names none. Never guessed
 * from the label: the module mints that grammar and does not also parse it back.
 */
const siteOf = (root: Root): Site => ({
  nodeType: root.nodeType ?? '',
  key: root.key ?? '',
  kind: root.kind ?? 'declaration',
});

/** The same walk, labels only and sorted, for a sweep that only names what it found. */
export function everyValidatorLabel(
  keep: (validator: PropertyValidator) => boolean,
  opts: WalkOptions = {}
): string[] {
  return everyValidator(keep, opts)
    .map(({ label }) => label)
    .sort();
}

/** Every registration the registry resolves, as walk roots. */
function registryRoots(registry: ValidatorRegistry): readonly (Root & RegisteredKey)[] {
  const roots: (Root & RegisteredKey)[] = [];
  for (const { nodeType, key, kind } of registeredKeys(registry)) {
    const validator = registry.declarationFor(nodeType, key);
    if (validator) roots.push({ label: `${nodeType}.${key}`, validator, nodeType, key, kind });
  }
  return roots;
}
