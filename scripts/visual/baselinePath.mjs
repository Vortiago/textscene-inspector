/**
 * Where a golden's baseline lives, as a path from the repository root. It imports nothing, so a CI
 * job that installs no dependencies can map a changed file to its golden.
 */

export const BASELINE_DIR = 'scripts/visual/baselines';

export function baselinePath(goldenName) {
  return `${BASELINE_DIR}/${goldenName}.png`;
}

/** @returns {string | null} the golden a repository path holds the baseline of, or null for any other file. */
export function goldenNameOf(path) {
  const prefix = `${BASELINE_DIR}/`;
  if (!path.startsWith(prefix) || !path.endsWith('.png')) return null;
  const name = path.slice(prefix.length, -'.png'.length);
  // The baselines sit flat in one directory, so a nested PNG is no golden's.
  return name.includes('/') ? null : name;
}
