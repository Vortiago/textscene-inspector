export interface NodePathParts {
  readonly absolute: boolean;
  readonly names: readonly string[];
  readonly subnames: readonly string[];
}

export const EMPTY_NODE_PATH: NodePathParts = Object.freeze({ absolute: false, names: [], subnames: [] });

/** The parts `NodePath(String)` (node_path.cpp:394) keeps, or nothing when an empty subname fails it. */
export function nodePathParts(path: string): NodePathParts | undefined {
  const colon = path.indexOf(':');
  const subnames = colon < 0 ? [] : path.slice(colon + 1).split(':');
  if (subnames.at(-1) === '') subnames.pop();
  if (subnames.includes('')) return undefined;
  const names = (colon < 0 ? path : path.slice(0, colon)).split('/').filter((name) => name !== '');
  return { absolute: path.startsWith('/'), names, subnames };
}

/**
 * `NodePath::operator String` (node_path.cpp:170) of the parts a NodePath holds.
 *
 * @canonical The text of a NodePath
 */
export function nodePathFromParts({ absolute, names, subnames }: NodePathParts): string {
  const subpath = subnames.join(':');
  return `${absolute ? '/' : ''}${names.join('/')}${subpath === '' ? '' : `:${subpath}`}`;
}
