/**
 * What the registry HOLDS, as the three populations a sweep can ask for.
 *
 * Beside `ValidatorRegistry.ts` rather than under `testing/`, because a sweep
 * author has to find it: the correct walk lived in a test-support directory for
 * five recurrences of the same defect, once written in a file whose own sibling
 * had already been migrated.
 *
 * Point lookups on a NAMED type stay the registry's interface — `findValidator`,
 * `getOwnKeys`, `baseChainOf`. Asking what the registry holds WITHOUT naming a
 * type is this module's alone. That line is what the population guard enforces.
 *
 * The populations are not nested, and choosing between them is the caller's one
 * real decision:
 *
 * - **types** — `registeredTypes(scope)`. Neither scope is a superset of the
 *   other, so the argument is required.
 * - **keys** — `registeredKeys()`. One entry per registration, declarations and
 *   removals alike, each tagged. Roots only, deliberately: a leaf is not a
 *   registration.
 * - **validators** — `everyValidator(keep)`. Every callable the registry can
 *   reach, dispatchers descended, shared leaf instances reported once. This is
 *   the only function that returns validators, and it cannot be made to stop at
 *   the roots.
 */

import { validatorRegistry, type ValidatorRegistry } from './ValidatorRegistry.js';
import type { PropertyValidator } from './propertyValidator.js';

/** Which map a registration came from. */
export type KeyKind = 'declaration' | 'removal';

/** One key ONE type registered, spelled as the registration spells it. */
export interface RegisteredKey {
  readonly nodeType: string;
  /**
   * A literal key, or a wildcard PATTERN (`settings/#/*`). Never a scene key —
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
  /** The registered pattern the root resolved under — the same at every depth. */
  readonly key: string;
  readonly kind: KeyKind;
  /** 0 at a root. Unbounded: a leaf can itself dispatch. */
  readonly depth: number;
  readonly validator: PropertyValidator;
}

/**
 * A validator to start a walk from, and the label to report it under.
 *
 * A root MAY carry the registration it came from; `registryRoots` fills those in
 * and an injected fixture usually does not. Declared rather than sniffed off the
 * object, so the walk reads them by type instead of casting — and a root that
 * carries none leaves the subject's site fields empty rather than having them
 * invented by splitting its label.
 */
export interface Root extends Partial<RegisteredKey> {
  readonly label: string;
  readonly validator: PropertyValidator;
}

/** How a walk is scoped and how it refuses to be vacuous. */
export interface WalkOptions {
  /**
   * Walk exactly these instead of the registry's own registrations. The seam a
   * guard uses to prove its own bite against scratch validators rather than
   * resting on whatever the registry happens to hold.
   */
  readonly roots?: readonly Root[];
  /**
   * Walk this registry rather than the live singleton, as both sibling
   * populations already allow. Without it a test driving a scratch registry had
   * to rebuild the root list by hand — the recomposition this module exists to
   * make unnecessary, in the module's own test.
   */
  readonly registry?: ValidatorRegistry;
  /**
   * Fail below this many validators VISITED. Counted before `keep`, because
   * every real sweep's `keep` is an offender filter whose expected answer is
   * `[]` — flooring the kept subjects would ask nothing, and could only ever be
   * satisfied by passing 0. A sweep that forgot `import './index.js'` walks
   * nothing and now says so.
   */
  readonly atLeast?: number;
}

/**
 * Types the registry can answer for.
 *
 * `'declaring'` is the validator map's key set — it includes a type that
 * registered an empty map on purpose (`CheckButton`) and excludes a type that
 * only takes a key away (`HBoxContainer`). `'answering'` unions the removals in.
 * Neither contains the other, which is why there is no default.
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
 * Every key any type registered, declarations then removals.
 *
 * Two walks, not a nested loop: a removal-only type never appears in the
 * validator map, so folding removals into the declaration loop visits none of
 * them.
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
 * Every validator the registry can run, dispatchers descended.
 *
 * `keep` decides what is REPORTED, never what is descended: a dispatcher that
 * fails it is still walked into, because excusing a validator must not excuse
 * the subtree behind it.
 *
 * Every root is a subject: a registration is reported under its own
 * `(nodeType, key)` even when its function is also a leaf of another root, or
 * the same function another type registered (`unavailableValidator` memoises on
 * reason and cite, so two removed keys are often one function). Only the walk
 * INTO leaves dedupes, by function identity: one leaf instance can back several
 * dispatchers and is reported once, under the first path that reaches it.
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

/** The same walk, labels only and sorted — a sweep that only NAMES what it found. */
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
