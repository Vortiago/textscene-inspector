/** The names a NodePath is built from: `core/string/node_path.cpp`. */

/**
 * The name segments `NodePath(String)` keeps, in order: only the runs between slashes (`:428-438`),
 * with the absolute marker on `data->absolute`. `.` and `..` are names the walk in `get_node_or_null`
 * reads (`node.cpp:1916-1924`). A `:subname` takes no part in the walk (`node.cpp:1912`), so a node
 * resolver drops it and a caller reproducing `String(NodePath)` keeps it.
 */
export function nodePathNames(path: string): string[] {
  return path.split('/').filter((segment) => segment !== '');
}

/**
 * The names a node walk reads: {@link nodePathNames} without the `:subname`. The constructor splits
 * at the first `:` and keeps only what precedes it as names (`node_path.cpp:405-427`).
 */
export function nodePathWalkNames(path: string): string[] {
  return nodePathNames(path.split(':')[0]!);
}
