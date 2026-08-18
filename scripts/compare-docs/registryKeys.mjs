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
  const source = key
    .split('')
    .map((ch) => {
      if (ch === '*') return '[^/]+';
      if (ch === '#') return '\\d+';
      return /[a-zA-Z0-9_/]/.test(ch) ? ch : `\\${ch}`;
    })
    .join('');
  const re = new RegExp(`^${source}$`);
  return (name) => re.test(name);
}

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
