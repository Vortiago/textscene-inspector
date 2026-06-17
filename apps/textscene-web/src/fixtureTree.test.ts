// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Fixture } from './fixtures';
import { buildFixtureTree, filterFixtureTree, type TreeBranch } from './fixtureTree';

function branch(tree: TreeBranch[], label: string): TreeBranch {
  const found = tree.find((b) => b.label === label);
  if (!found) throw new Error(`branch "${label}" not found in [${tree.map((b) => b.label)}]`);
  return found;
}

describe('buildFixtureTree', () => {
  it('places a non-demo fixture as a leaf under its category (tracer)', () => {
    const fx: Fixture[] = [{ name: 'Box Mesh', file: 'unit-box.tscn', category: 'Unit - Meshes' }];
    const tree = buildFixtureTree(fx);
    expect(branch(tree, 'Unit - Meshes').children).toEqual([
      { kind: 'scene', label: 'Box Mesh', file: 'unit-box.tscn' },
    ]);
  });

  it('nests a demo fixture as Category → Project → folder(s) → scene', () => {
    const fx: Fixture[] = [
      {
        name: 'Platformer (3D): coin/coin',
        file: 'demos/3d/platformer/coin/coin.tscn',
        category: 'Godot Demos - 3D',
        root: 'demos/3d/platformer',
      },
    ];
    const tree = buildFixtureTree(fx);
    const project = branch(branch(tree, 'Godot Demos - 3D').children as TreeBranch[], 'Platformer');
    const folder = branch(project.children as TreeBranch[], 'coin');
    expect(folder.children).toEqual([
      { kind: 'scene', label: 'coin', file: 'demos/3d/platformer/coin/coin.tscn' },
    ]);
  });

  it('groups multiple scenes of one project under shared folder branches', () => {
    const fx: Fixture[] = [
      { name: 'a', file: 'demos/3d/p/coin/coin.tscn', category: 'Godot Demos - 3D', root: 'demos/3d/p' },
      { name: 'b', file: 'demos/3d/p/enemy/enemy.tscn', category: 'Godot Demos - 3D', root: 'demos/3d/p' },
      { name: 'c', file: 'demos/3d/p/main.tscn', category: 'Godot Demos - 3D', root: 'demos/3d/p' },
    ];
    const project = branch(branch(buildFixtureTree(fx), 'Godot Demos - 3D').children as TreeBranch[], 'P');
    // two folder branches (coin, enemy) + one top-level scene leaf (main)
    const labels = project.children.map((c) => c.label).sort();
    expect(labels).toEqual(['coin', 'enemy', 'main']);
  });
});

describe('filterFixtureTree', () => {
  const fx: Fixture[] = [
    { name: 'Box Mesh', file: 'unit-box.tscn', category: 'Unit - Meshes' },
    { name: 'x', file: 'demos/3d/platformer/coin/coin.tscn', category: 'Godot Demos - 3D', root: 'demos/3d/platformer' },
    { name: 'y', file: 'demos/3d/platformer/enemy/enemy.tscn', category: 'Godot Demos - 3D', root: 'demos/3d/platformer' },
  ];
  const tree = buildFixtureTree(fx);

  it('returns the full tree for an empty query', () => {
    expect(filterFixtureTree(tree, '')).toEqual(tree);
  });

  it('keeps only leaves matching the query (by name or path) plus their ancestors', () => {
    const filtered = filterFixtureTree(tree, 'coin');
    // 'Unit - Meshes' drops entirely; the 'coin' path survives, 'enemy' does not.
    expect(filtered.map((b) => b.label)).toEqual(['Godot Demos - 3D']);
    const project = branch(filtered[0]!.children as TreeBranch[], 'Platformer');
    expect(project.children.map((c) => c.label)).toEqual(['coin']);
  });

  it('matches case-insensitively against the file path', () => {
    expect(filterFixtureTree(tree, 'ENEMY')[0]?.label).toBe('Godot Demos - 3D');
  });
});
