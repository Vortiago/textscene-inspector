/** Utilities for manipulating node paths in the scene tree. */

export function joinPath(parentPath: string, childName: string): string {
  return parentPath ? `${parentPath}/${childName}` : childName;
}

export function getParentPath(nodePath: string): string {
  const lastSlash = nodePath.lastIndexOf('/');
  return lastSlash === -1 ? '' : nodePath.substring(0, lastSlash);
}

export function getAncestorPaths(nodePath: string): string[] {
  const parts = nodePath.split('/');
  const ancestors: string[] = [];

  for (let i = 1; i < parts.length; i++) {
    ancestors.push(parts.slice(0, i).join('/'));
  }

  return ancestors;
}

export function isAncestor(ancestorPath: string, descendantPath: string): boolean {
  return descendantPath.startsWith(ancestorPath + '/');
}

export function getNodeName(nodePath: string): string {
  const lastSlash = nodePath.lastIndexOf('/');
  return lastSlash === -1 ? nodePath : nodePath.substring(lastSlash + 1);
}
