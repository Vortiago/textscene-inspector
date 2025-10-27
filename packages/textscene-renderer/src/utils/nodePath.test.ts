import { describe, it, expect } from 'vitest';
import { joinPath, getParentPath, getAncestorPaths, isAncestor, getNodeName } from './nodePath';

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

  describe('getParentPath', () => {
    it('should extract parent path from node path', () => {
      expect(getParentPath('Root/Player/Mesh')).toBe('Root/Player');
    });

    it('should return empty string for root node', () => {
      expect(getParentPath('Root')).toBe('');
    });

    it('should handle deeply nested paths', () => {
      expect(getParentPath('A/B/C/D')).toBe('A/B/C');
    });

    it('should handle two-level paths', () => {
      expect(getParentPath('Root/Child')).toBe('Root');
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

  describe('isAncestor', () => {
    it('should return true when first path is ancestor', () => {
      expect(isAncestor('Root/Player', 'Root/Player/Mesh')).toBe(true);
    });

    it('should return false when first path is not ancestor', () => {
      expect(isAncestor('Root/Enemy', 'Root/Player/Mesh')).toBe(false);
    });

    it('should return false when paths are equal', () => {
      expect(isAncestor('Root/Player', 'Root/Player')).toBe(false);
    });

    it('should return true for deep nesting', () => {
      expect(isAncestor('A', 'A/B/C/D')).toBe(true);
    });

    it('should return false for sibling paths', () => {
      expect(isAncestor('A/B', 'A/C')).toBe(false);
    });
  });

  describe('getNodeName', () => {
    it('should extract node name from path', () => {
      expect(getNodeName('Root/Player/Mesh')).toBe('Mesh');
    });

    it('should return full name for root node', () => {
      expect(getNodeName('Root')).toBe('Root');
    });

    it('should handle two-level path', () => {
      expect(getNodeName('Root/Child')).toBe('Child');
    });
  });
});
