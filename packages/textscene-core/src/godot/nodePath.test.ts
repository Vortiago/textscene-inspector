import { describe, expect, it } from 'vitest';
import {
  nodePathNames,
  nodePathWalkNames,
  resolveNodePathLiteral,
  resolveParentPath,
  resolveRelativePath,
  unclaimedUniqueNames,
} from './nodePath.js';

describe('nodePathNames', () => {
  it.each([
    ['A/B', ['A', 'B']],
    ['A//B', ['A', 'B']],
    ['A/', ['A']],
    ['/root/A', ['root', 'A']],
    ['', []],
  ])('drops every empty segment of %s', (path, names) => {
    expect(nodePathNames(path)).toEqual(names);
  });

  it.each([
    ['./A', ['.', 'A']],
    ['../A', ['..', 'A']],
    ['A/./B', ['A', '.', 'B']],
  ])('keeps %s as names, since the constructor does', (path, names) => {
    // `.` and `..` reach `data->path` and are folded by the walk
    // (node.cpp:1916-1924), not by the constructor.
    expect(nodePathNames(path)).toEqual(names);
  });

  it.each([
    ['A:x', ['A']],
    ['A/B:x:y', ['A', 'B']],
    [':x', []],
  ])('drops the :subname of %s, which the walk never reads', (path, names) => {
    // The constructor splits at the first `:` and keeps only what precedes it
    // as names (node_path.cpp:405-427), so `get_node_or_null` addresses `A`.
    expect(nodePathWalkNames(path)).toEqual(names);
  });

  it('leaves a path with no colon exactly as nodePathNames reads it', () => {
    expect(nodePathWalkNames('./A//B/')).toEqual(nodePathNames('./A//B/'));
  });
});

describe('resolveRelativePath', () => {
  it('walks from the base node itself', () => {
    expect(resolveRelativePath('Root/Player', '../Arm')).toBe('Root/Arm');
  });

  it('stays with `.` and steps up with `..`', () => {
    expect(resolveRelativePath('Root/Player', './../Arm')).toBe('Root/Arm');
  });

  it('reaches the scene root, the first segment of the base path', () => {
    expect(resolveRelativePath('Root/Player', '..')).toBe('Root');
  });

  it('refuses a `..` above the scene root', () => {
    // `!current->data.parent` returns nullptr (node.cpp:1919-1922).
    expect(resolveRelativePath('Root/Player', '../..')).toBeNull();
  });

  it('drops a :subname, which addresses a property and not a node', () => {
    expect(resolveRelativePath('Root/Player', 'Arm:position')).toBe('Root/Player/Arm');
  });

  it('reaches nothing for an absolute path, which measures from the live SceneTree', () => {
    expect(resolveRelativePath('Root/Player', '/root/Root/Arm')).toBeNull();
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
  const seated = new Set(['', 'Mid', 'Mid/Leaf', 'Other']);
  const inTree = {
    exists: (path: string) => seated.has(path),
    uniquePaths: new Map([['%Hud', 'Mid/Leaf']]),
  };

  it('resolves the scene root to the empty path', () => {
    // Paths here omit the root's own name, so the root is the empty path: `SCENE_ROOT_PATH`.
    expect(resolveParentPath('.', inTree)).toBe('');
  });

  it('descends from the root without naming it', () => {
    expect(resolveParentPath('Mid/Leaf', inTree)).toBe('Mid/Leaf');
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

  it('folds without a tree, which is the wider answer a caller with none gets', () => {
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

  it('jumps a %Name to the path claiming it, rather than descending onto it', () => {
    // `get_node_or_null` reads the owner's table and continues from what it
    // finds (node.cpp:1930-1938), so the walk restarts there.
    expect(resolveParentPath('%Hud', inTree)).toBe('Mid/Leaf');
    expect(resolveParentPath('%Hud/..', inTree)).toBe('Mid');
  });

  it('refuses a %Name no node claims', () => {
    expect(resolveParentPath('%Missing', inTree)).toBeNull();
  });

  it('refuses a %Name when the caller holds no tree at all', () => {
    expect(resolveParentPath('%Hud')).toBeNull();
  });
});

describe('unclaimedUniqueNames', () => {
  const claims = new Map([['%Target', 'Root/Target']]);

  it('names each %Name segment nothing claims', () => {
    expect(unclaimedUniqueNames('NodePath("%Target/%Absent/../%Gone")', claims)).toEqual([
      '%Absent',
      '%Gone',
    ]);
  });

  it('names nothing when every %Name is claimed', () => {
    expect(unclaimedUniqueNames('NodePath("%Target/Mesh")', claims)).toEqual([]);
  });

  it('names every %Name when the caller passes no claim table', () => {
    expect(unclaimedUniqueNames('NodePath("../%Target")')).toEqual(['%Target']);
  });

  it('ignores a %Name inside the :subname, which the walk never reads', () => {
    expect(unclaimedUniqueNames('NodePath("Mesh:%notanode")', claims)).toEqual([]);
  });

  it.each([[undefined], ['NodePath("")'], ['NodePath(".")'], ['NodePath("/root/%Absent")']])(
    'names nothing for %s, which addresses no node here by construction',
    (raw) => {
      expect(unclaimedUniqueNames(raw, claims)).toEqual([]);
    }
  );
});
