import { describe, it, expect } from 'vitest';
import {
  belowRoot,
  joinPath,
  getAncestorPaths,
  nodesByPath,
  pathBetween,
  pathUnder,
  spelledLiveNodePath,
  spelledNodePath,
} from './nodePath';

describe('nodePath utilities', () => {
  describe('belowRoot', () => {
    it('drops the root name from a live path', () => {
      expect(belowRoot('Root/Player/Camera3D')).toBe('Player/Camera3D');
    });

    it('answers the empty root path for the root itself', () => {
      expect(belowRoot('Root')).toBe('');
    });
  });

  describe('spelledNodePath', () => {
    it('spells the root as "." where a NodePath has no empty path (node_path.cpp:300-302)', () => {
      expect(spelledNodePath('')).toBe('.');
    });

    it('leaves a path below the root as it is', () => {
      expect(spelledNodePath('Player/Camera3D')).toBe('Player/Camera3D');
    });
  });

  describe('spelledLiveNodePath', () => {
    it.each([
      ['the root', 'Root', '.'],
      ['a child of the root', 'Root/Player', 'Player'],
      ['a deeper node', 'Root/Player/Camera3D', 'Player/Camera3D'],
    ])('copies %s as Godot does (node.cpp:2332-2334)', (_what, livePath, expected) => {
      expect(spelledLiveNodePath(livePath)).toBe(expected);
    });
  });

  describe('pathBetween', () => {
    it('spells a node below as its path from the start', () => {
      expect(pathBetween('Root/Hud', 'Root/Hud/Panel/Lamp')).toBe('Panel/Lamp');
    });

    it('climbs with .. to a node outside the start', () => {
      expect(pathBetween('Root/Hud/Inner', 'Root/Lamp')).toBe('../../Lamp');
    });
  });

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

  describe('pathUnder', () => {
    it('places a root-relative path below the node at the parent path', () => {
      expect(pathUnder('Main/Level', 'Door/Hinge')).toBe('Main/Level/Door/Hinge');
    });

    it('places the root at the parent path itself (edge case)', () => {
      expect(pathUnder('Main/Level', belowRoot('Level'))).toBe('Main/Level');
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

describe('nodesByPath', () => {
  interface Tree {
    name: string;
    children: Tree[];
  }
  const leaf = (name: string): Tree => ({ name, children: [] });

  it('keys every node by its path from the root, parents before their children', () => {
    const roots = [{ name: 'Root', children: [{ name: 'A', children: [leaf('B')] }, leaf('C')] }];

    expect([...nodesByPath(roots).keys()]).toEqual(['Root', 'Root/A', 'Root/A/B', 'Root/C']);
  });

  it('holds the node itself under its path', () => {
    const child = leaf('A');
    const root = { name: 'Root', children: [child] };

    expect(nodesByPath([root]).get('Root/A')).toBe(child);
  });

  it('holds nothing for no roots (edge case)', () => {
    expect(nodesByPath([]).size).toBe(0);
  });
});
