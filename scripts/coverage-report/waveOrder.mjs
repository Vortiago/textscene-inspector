/**
 * The order a node-coverage push works in: which type comes next, and which
 * family its group belongs to. Shared by the ledger (which sorts `missing`)
 * and the report (which groups it).
 */

/**
 * Wave order: base classes first, so a leaf slice declares only its own members
 * and inherits the rest through NODE_BASE_TYPES; then families largest-shared-
 * vocabulary first, so duplication surfaces inside one wave instead of five
 * waves apart. Groups are `node-catalog.json`'s own `group` values.
 */
const FAMILY_ORDER = [
  'Physics — queries',
  'Physics — bodies',
  'Physics — vehicles',
  'Physics — joints',
  'Particles',
  'UI — controls',
  'UI — containers',
  'UI — windows',
  'Skeleton, bones & IK',
  'Reflection & global illumination',
  'Meshes & rendering',
  'Navigation',
  'Collision shapes',
  'Visibility',
  '2D rendering',
  'Canvas effects',
  'Canvas layers',
  'Parallax & scrolling',
  'Lighting',
  'Cameras',
  'Viewports',
  'Touch input',
  'Audio',
  'Networking',
  'XR / AR',
];

/**
 * A node is a "base class" here when some other catalogued node lists it as an
 * ancestor. Godot's own hierarchy already says so — every catalog entry carries
 * its `chain` — so this is derived rather than listed: a hand-written list had
 * already gone stale after one wave, and a base nobody remembered to add would
 * sort as an ordinary leaf and turn the wave that reaches its subclass red for
 * a reason that reads as unrelated.
 */
export const baseClassesOf = (nodes) => new Set(nodes.flatMap((n) => n.chain));

/** Family position; anything ungrouped sorts after every named family. */
export function familyRank(group) {
  const i = FAMILY_ORDER.indexOf(group);
  return i === -1 ? FAMILY_ORDER.length : i;
}

/**
 * Base classes first — shallowest chain first, so a base lands before any base
 * derived from it (`Container` before `BoxContainer`) — then family, then name.
 * `isBase` is stamped on each node by `collectCoverage`.
 */
export const byWave = (a, b) =>
  Number(!a.isBase) - Number(!b.isBase) ||
  (a.isBase ? a.chain.length - b.chain.length : familyRank(a.group) - familyRank(b.group)) ||
  a.name.localeCompare(b.name);
