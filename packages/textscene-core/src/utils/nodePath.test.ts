import { describe, it, expect } from 'vitest';
import {
  joinPath,
  getAncestorPaths,
  resolveNodePathLiteral,
  resolveParentPath,
  SCENE_ROOT_PATH,
} from './nodePath';

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

  describe('resolveParentPath', () => {
    const tree = new Set(['', 'Mid', 'Mid/Leaf', 'Other']);
    const inTree = (path: string) => tree.has(path);

    it('resolves the scene root to the key it occupies', () => {
      expect(resolveParentPath('.', inTree)).toBe(SCENE_ROOT_PATH);
    });

    it.each([['Mid'], ['./Mid'], ['Mid/'], ['Mid//'], ['./Mid/.'], ['Mid:position']])(
      'folds %s onto the one node Godot resolves it to',
      (path) => {
        expect(resolveParentPath(path, inTree)).toBe('Mid');
      }
    );

    it('steps back through a name the tree holds', () => {
      expect(resolveParentPath('Other/../Mid', inTree)).toBe('Mid');
    });

    it('stops at a name the tree does not hold, rather than folding past it', () => {
      // `children.getptr(name)` misses and returns nullptr on the spot
      // (node.cpp:1941-1946), so the `..` behind it never runs.
      expect(resolveParentPath('Missing/../Mid', inTree)).toBeNull();
    });

    it('folds without an `exists`, which is the wider answer a caller with no tree gets', () => {
      expect(resolveParentPath('Missing/../Mid')).toBe('Mid');
    });

    it.each([[undefined], ['']])('addresses nothing for %s', (path) => {
      expect(resolveParentPath(path, inTree)).toBeNull();
    });

    it('refuses an absolute path, which instantiate cannot measure off-tree', () => {
      expect(resolveParentPath('/root/Mid', inTree)).toBeNull();
    });

    it('refuses a .. that steps above the root', () => {
      expect(resolveParentPath('../Mid', inTree)).toBeNull();
    });

    it('refuses a %Name, since the claims are derived from the tree this builds', () => {
      expect(resolveParentPath('%Hud', inTree)).toBeNull();
    });
  });
});
