/**
 * How a registered validator key matches an engine property name.
 *
 * A fact about `ValidatorRegistry`, not about either coverage ledger, so it
 * lives here rather than being spelled out twice: both ledgers ask the same
 * question of two disjoint hierarchies, and a copy each is a copy that can
 * disagree about what counts as covered.
 */

/**
 * A registered key can stand for a whole indexed family.
 *
 * `Generic6DOFJoint3D` registers 18 wildcard keys covering 84 engine
 * properties, and `PropertyListHelper` families register as `item_#/*`. Compared
 * literally these read as the single largest gap in the codebase while being
 * entirely covered, which is the difference between a ledger and a scare.
 */
export function keyMatcher(key) {
  if (!key.includes('*') && !key.includes('#')) return (name) => name === key;
  const shape = WILDCARD_SHAPES.find(({ suffix }) => key.endsWith(suffix));
  // `buildWildcardIndex` recognises the same four suffixes and DROPS anything
  // else, so such a registration reaches no property at all. Every registered
  // wildcard key in the tree carries one of them; mirroring the drop keeps this
  // matcher honest if one ever does not, rather than crediting coverage the
  // registry does not provide.
  if (!shape) return () => false;
  const re = new RegExp(`^${literal(key.slice(0, -shape.suffix.length))}${shape.tail}$`);
  return (name) => re.test(name);
}

/** Every character of a registered prefix stands for itself. */
const literal = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The four shapes, matched the way `linter/wildcardIndex.ts` matches them, most
 * specific suffix first (`#/**` ends with `/*` too).
 *
 * The DEPTH each one reaches is the part a single `[^/]+` per `*` cannot
 * express. A plain `<prefix>/*` is `findOwnValidator`'s bare `startsWith`, so
 * `voice/*` covers `voice/1/cutoff_hz`; `#/**` likewise reaches any depth under
 * a glued index, which is the whole reason that shape exists beside `#/*`.
 * Matched one segment deep, a registration covering such a family reads as
 * covering nothing and the ledger reports a gap that is not there —
 * `AudioEffectChorus` alone declares 24 properties of that shape.
 *
 * The index halves stay `\d+` rather than the registry's shape-only match: the
 * subject here is the names Godot's own property lists emit, and those are
 * always numeric, so nothing widens what a real engine property can match.
 */
const WILDCARD_SHAPES = [
  // `terrain_set_#/**` — glued index, leaf may nest (matchesIndexedSubtree).
  { suffix: '#/**', tail: '\\d+/.+' },
  // `item_#/*` — glued index, exactly one leaf segment (matchesIndexedKey).
  { suffix: '#/*', tail: '\\d+/[^/]+' },
  // `bones/*` — a literal `/` follows the prefix and any depth below matches.
  { suffix: '/*', tail: '/.+' },
  // `pattern_#` — the whole key below the prefix IS the index, no leaf at all.
  { suffix: '#', tail: '\\d+' },
];

/**
 * Per declaring class, not per leaf: a validator for a `BaseMaterial3D`
 * property belongs on `BaseMaterial3D`, so the base-walk is deliberately not
 * applied and `getOwnKeys` is asked instead of `findValidator`.
 */
export function unvalidatedByClass(engine, validatorRegistry, covered) {
  const rows = [];
  for (const [cls, props] of Object.entries(engine)) {
    if (!covered.has(cls)) continue;
    const matchers = validatorRegistry.getOwnKeys(cls).map(keyMatcher);
    const missing = props.map((p) => p.name).filter((name) => !matchers.some((m) => m(name)));
    if (missing.length > 0) rows.push({ cls, missing });
  }
  return rows.sort((a, b) => b.missing.length - a.missing.length);
}
