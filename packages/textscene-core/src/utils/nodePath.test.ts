import { describe, it, expect } from 'vitest';
import { joinPath, getAncestorPaths, treePathOf } from './nodePath';

describe('nodePath utilities', () => {
  describe('joinPath', () => {
    it('should join parent path with child name', () => {
      expect(joinPath('Root/Player', 'Mesh')).toBe('Root/Player/Mesh');
    });

    it('should return child name when parent path is empty', () => {
      expect(joinPath('', 'Root')).toBe('Root');
    });

    it('should handle deeply nested paths', () => {
      expect(joinPath('A/B/C', 'D')).toBe('A/B/C/D');
    });
  });

  describe('getAncestorPaths', () => {
    it('should return all ancestor paths', () => {
      expect(getAncestorPaths('A/B/C/D')).toEqual(['A', 'A/B', 'A/B/C']);
    });

    it('should return empty array for root node', () => {
      expect(getAncestorPaths('Root')).toEqual([]);
    });

    it('should return single ancestor for two-level path', () => {
      expect(getAncestorPaths('Root/Child')).toEqual(['Root']);
    });

    it('should handle three-level path', () => {
      expect(getAncestorPaths('A/B/C')).toEqual(['A', 'A/B']);
    });
  });
});

describe('treePathOf', () => {
  const leaf = { name: 'Leaf', children: [] };
  const mid = { name: 'Mid', children: [leaf] };
  const root = { name: 'Root', children: [mid] };

  it('joins the names below the root, which it leaves out', () => {
    expect(treePathOf(root, leaf)).toBe('Mid/Leaf');
  });

  it('places the root itself at the empty path', () => {
    expect(treePathOf(root, root)).toBe('');
  });

  it('gives nothing for a node outside the tree', () => {
    expect(treePathOf(root, { name: 'Lost', children: [] })).toBeUndefined();
  });

  it('keeps the instanced path a node hangs below, as the tree builder keys it', () => {
    const inner = { name: 'Inner', children: [], instanceSubPath: 'Hinge/Pin' };
    expect(treePathOf({ name: 'Root', children: [{ name: 'Door', children: [inner] }] }, inner)).toBe(
      'Door/Hinge/Pin/Inner'
    );
  });
});
