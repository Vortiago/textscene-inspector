import { describe, it, expect } from 'vitest';
import { joinPath, getAncestorPaths } from './nodePath';

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
