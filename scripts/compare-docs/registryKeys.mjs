/**
 * How a registered validator key matches an engine property name. Both coverage
 * ledgers ask this of disjoint hierarchies, so one copy keeps them agreeing.
 */

/**
 * A registered key can stand for a whole indexed family, such as the
 * `PropertyListHelper` family `item_#/*`. Compared literally, a covered family
 * reads as a gap.
 */
export function keyMatcher(key) {
  if (!key.includes('*') && !key.includes('#')) return (name) => name === key;
  const shape = WILDCARD_SHAPES.find(({ suffix }) => key.endsWith(suffix));
  // `buildWildcardIndex` recognises the same four suffixes and drops anything
  // else, so such a registration reaches no property. This mirrors the drop.
  if (!shape) return () => false;
  const re = new RegExp(`^${literal(key.slice(0, -shape.suffix.length))}${shape.tail}$`);
  return (name) => re.test(name);
}

/** Every character of a registered prefix stands for itself. */
const literal = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The four shapes, matched as `linter/wildcardIndex.ts` does, most specific
 * suffix first (`#/**` ends with `/*` too). The index halves stay `\d+`, since
 * Godot's property lists always emit a numeric index.
 */
const WILDCARD_SHAPES = [
  // `terrain_set_#/**`: glued index, leaf may nest (matchesIndexedSubtree).
  { suffix: '#/**', tail: '\\d+/.+' },
  // `item_#/*`: glued index, exactly one leaf segment (matchesIndexedKey).
  { suffix: '#/*', tail: '\\d+/[^/]+' },
  // `bones/*`: `findOwnValidator`'s bare `startsWith`, so any depth matches.
  { suffix: '/*', tail: '/.+' },
  // `pattern_#`: the whole key below the prefix is the index, no leaf.
  { suffix: '#', tail: '\\d+' },
];

/**
 * Per declaring class, not per leaf: a `BaseMaterial3D` property's validator
 * belongs on `BaseMaterial3D`, so this asks `getOwnKeys`, not `findValidator`.
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
