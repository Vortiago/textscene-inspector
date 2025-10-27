/**
 * Generates deterministic hashes for TSCN nodes to detect changes efficiently.
 */

import type { TscnNode } from '../parser/types';

/**
 * FNV-1a hash algorithm for fast, deterministic string hashing.
 */
function fnv1aHash(str: string): number {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }
  return hash >>> 0; // Convert to unsigned 32-bit integer
}

/**
 * Generates a hash for a TSCN node based on its type, name, and properties.
 * Excludes children to allow independent node comparison.
 */
export function hashTscnNode(node: TscnNode): string {
  const parts: string[] = [
    `type:${node.type}`,
    `name:${node.name}`,
  ];

  // Add parent if specified
  if (node.parent) {
    parts.push(`parent:${node.parent}`);
  }

  // Add all properties in sorted order for deterministic hashing
  const propKeys = Object.keys(node.properties).sort();
  for (const key of propKeys) {
    const value = (node.properties as Record<string, unknown>)[key];
    if (value !== undefined) {
      parts.push(`${key}:${JSON.stringify(value)}`);
    }
  }

  // Join all parts and hash
  const combined = parts.join('|');
  const hash = fnv1aHash(combined);

  return hash.toString(36); // Base36 for shorter string representation
}

/**
 * Builds a map of node paths to their hashes from a node tree.
 */
export function buildNodeHashMap(nodes: TscnNode[], parentPath = ''): Map<string, string> {
  const map = new Map<string, string>();

  for (const node of nodes) {
    const nodePath = parentPath ? `${parentPath}/${node.name}` : node.name;
    const hash = hashTscnNode(node);
    map.set(nodePath, hash);

    // Recursively process children
    if (node.children && node.children.length > 0) {
      const childMap = buildNodeHashMap(node.children, nodePath);
      childMap.forEach((childHash, childPath) => {
        map.set(childPath, childHash);
      });
    }
  }

  return map;
}
