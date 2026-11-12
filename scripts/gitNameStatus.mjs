/**
 * Reads `git diff --name-status --no-renames` output, one `<status>\t<path>` entry per line. The
 * push checks, the Goldens touched comment and `pnpm pr:state` share it, so they name a change alike.
 */

/** Every `change` an entry can carry, in the order a summary counts them. */
export const CHANGES = ['added', 'changed', 'removed'];

const CHANGE_OF_STATUS = { A: 'added', D: 'removed' };

/**
 * The `{ change, path }` of each entry, where `change` is `added`, `changed` or `removed`. A type
 * change (`T`), the only other status `--no-renames` gives between two commits, reads as changed.
 *
 * @canonical Read `git diff --name-status` output
 */
export function changedEntries(nameStatus) {
  return nameStatus.split('\n').flatMap((line) => {
    const [status, path] = line.split('\t');
    return path ? [{ change: CHANGE_OF_STATUS[status] ?? 'changed', path }] : [];
  });
}
