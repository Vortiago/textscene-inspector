import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Fixture } from './fixtures';
import { FixtureTreeView } from './FixtureTree';

const FIXTURES: Fixture[] = [
  { name: 'Box Mesh', file: 'unit-box.tscn', category: 'Unit - Meshes' },
  {
    name: 'x',
    file: 'demos/3d/platformer/coin/coin.tscn',
    category: 'Godot Demos - 3D',
    root: 'demos/3d/platformer',
  },
  {
    name: 'y',
    file: 'demos/3d/platformer/enemy/enemy.tscn',
    category: 'Godot Demos - 3D',
    root: 'demos/3d/platformer',
  },
];

function renderTree(query = '', onSelect = vi.fn()) {
  render(
    <FixtureTreeView fixtures={FIXTURES} query={query} selectedFile="unit-box.tscn" onSelect={onSelect} />
  );
  return { onSelect };
}

describe('FixtureTreeView', () => {
  it('renders categories collapsed (scenes hidden until expanded)', () => {
    renderTree();
    expect(screen.getByRole('button', { name: /Unit - Meshes/ })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Box Mesh$/ })).toBeNull();
  });

  it('expands a category branch to reveal its scenes', () => {
    renderTree();
    act(() => fireEvent.click(screen.getByRole('button', { name: /Unit - Meshes/ })));
    expect(screen.getByRole('button', { name: /^Box Mesh$/ })).toBeDefined();
  });

  it('nests demo scenes under Project → folder and selecting reports the file', () => {
    const { onSelect } = renderTree();
    act(() => fireEvent.click(screen.getByRole('button', { name: /Godot Demos - 3D/ })));
    act(() => fireEvent.click(screen.getByRole('button', { name: /▸ Platformer/ })));
    act(() => fireEvent.click(screen.getByRole('button', { name: /▸ coin/ })));
    act(() => fireEvent.click(screen.getByRole('button', { name: /^coin$/ })));
    expect(onSelect).toHaveBeenCalledWith('demos/3d/platformer/coin/coin.tscn');
  });

  it('auto-expands and filters to matches when a query is given', () => {
    const { onSelect } = renderTree('coin');
    expect(screen.queryByRole('button', { name: /^enemy$/ })).toBeNull();
    act(() => fireEvent.click(screen.getByRole('button', { name: /^coin$/ })));
    expect(onSelect).toHaveBeenCalledWith('demos/3d/platformer/coin/coin.tscn');
  });
});
