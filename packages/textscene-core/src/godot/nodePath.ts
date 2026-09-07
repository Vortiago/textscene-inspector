/**
 * The names a NodePath is built from — `core/string/node_path.cpp`.
 */

/**
 * The name segments `NodePath(String)` keeps, in order.
 *
 * The constructor counts only the runs BETWEEN slashes (`:428-438`), so a
 * leading, doubled or trailing slash contributes no name and the absolute
 * marker is carried on `data->absolute` rather than as a segment. `.` and `..`
 * ARE names: they survive into `data->path` and are read by the walk in
 * `get_node_or_null` (`node.cpp:1916-1924`), which is why folding them is a
 * separate act from spelling the path.
 *
 * A `:subname` addresses a property rather than a node and takes no part in the
 * walk (`node.cpp:1912` loops over `get_name_count()` alone), so callers that
 * resolve a node drop it and callers that reproduce `String(NodePath)` keep it.
 */
export function nodePathNames(path: string): string[] {
  return path.split('/').filter((segment) => segment !== '');
}

/**
 * The names a node walk reads: {@link nodePathNames} with any `:subname`
 * dropped.
 *
 * The constructor splits at the FIRST `:` and keeps only what precedes it as
 * names (`node_path.cpp:405-427`), so `A:x` addresses the node `A` and the walk
 * never sees `x`.
 */
export function nodePathWalkNames(path: string): string[] {
  return nodePathNames(path.split(':')[0]!);
}
