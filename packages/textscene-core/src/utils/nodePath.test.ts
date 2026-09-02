import { describe, it, expect } from 'vitest';
import { joinPath, getAncestorPaths, resolveNodePathLiteral } from './nodePath';

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

  describe('resolveNodePathLiteral with a bare string', () => {
    // `variant.cpp:746-749` lists STRING as a strict source for NODE_PATH, so
    // `remote_path = "Target"` resolves exactly as `NodePath("Target")` does.
    it('resolves the quoted string a NodePath slot converts', () => {
      expect(resolveNodePathLiteral('Root/Relay', '"Target"')).toBe('Root/Relay/Target');
      expect(resolveNodePathLiteral('Root/Relay', '"../Other"')).toBe('Root/Other');
    });
  });

  describe('resolveNodePathLiteral with unique names', () => {
    // `%Target` is claimed by the node at Root/Target; nothing claims `%Absent`.
    const claims = new Map([['%Target', 'Root/Target']]);

    it('resolves a unique name to the claiming node, ignoring where it was written', () => {
      expect(resolveNodePathLiteral('Root/Deep/Relay', 'NodePath("%Target")', claims)).toBe(
        'Root/Target'
      );
    });

    it('descends from the claimed node', () => {
      expect(resolveNodePathLiteral('Root/Relay', 'NodePath("%Target/Mesh")', claims)).toBe(
        'Root/Target/Mesh'
      );
    });

    it('jumps rather than appends, so a following `..` steps up from the CLAIMED node', () => {
      expect(resolveNodePathLiteral('Root/A/B/Relay', 'NodePath("%Target/../Other")', claims)).toBe(
        'Root/Other'
      );
    });

    it('resolves a unique name reached part-way through a walk', () => {
      expect(resolveNodePathLiteral('Root/Relay', 'NodePath("../%Target")', claims)).toBe(
        'Root/Target'
      );
    });

    it('returns null when no node claims the name', () => {
      expect(resolveNodePathLiteral('Root/Relay', 'NodePath("%Absent")', claims)).toBeNull();
    });

    it('returns null for a unique name when the caller passes no claim table', () => {
      expect(resolveNodePathLiteral('Root/Relay', 'NodePath("%Target")')).toBeNull();
    });

    it('leaves an ordinary relative path alone', () => {
      expect(resolveNodePathLiteral('Root/Relay', 'NodePath("../Sibling")', claims)).toBe(
        'Root/Sibling'
      );
    });
  });

});
