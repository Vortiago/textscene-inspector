/**
 * Builds the Category → Project → folder → scene tree from the flat fixture manifest,
 * and a recursive name and path filter. Like Godot's FileSystem dock, demo projects
 * nest by their res:// folders, and other categories list scenes directly.
 */

import type { Fixture } from './fixtures';

export interface SceneLeaf {
  kind: 'scene';
  label: string;
  file: string;
}

export interface TreeBranch {
  kind: 'branch';
  label: string;
  children: TreeItem[];
}

export type TreeItem = TreeBranch | SceneLeaf;

export function buildFixtureTree(fixtures: readonly Fixture[]): TreeBranch[] {
  const roots: TreeBranch[] = [];

  for (const fixture of fixtures) {
    const category = getOrCreateBranch(roots, fixture.category);

    if (fixture.root && fixture.file.startsWith('demos/')) {
      const project = humanize(fixture.root.split('/').pop() ?? fixture.root);
      const rel = fixture.file.slice(fixture.root.length + 1); // path within the project
      const segments = rel.split('/');
      const scene = segments[segments.length - 1]!.replace(/\.tscn$/, '');
      const folders = segments.slice(0, -1);

      let parent = getOrCreateBranch(category.children, project);
      for (const folder of folders) {
        parent = getOrCreateBranch(parent.children, folder);
      }
      parent.children.push({ kind: 'scene', label: scene, file: fixture.file });
    } else {
      category.children.push({ kind: 'scene', label: fixture.name, file: fixture.file });
    }
  }

  return roots;
}

/** Keeps only scenes whose label or file contains `query`, plus their branches. */
export function filterFixtureTree(tree: readonly TreeBranch[], query: string): TreeBranch[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return tree as TreeBranch[];
  return tree
    .map((branch) => filterBranch(branch, needle))
    .filter((branch): branch is TreeBranch => branch !== null);
}

function filterBranch(branch: TreeBranch, needle: string): TreeBranch | null {
  const children: TreeItem[] = [];
  for (const child of branch.children) {
    if (child.kind === 'scene') {
      if (child.label.toLowerCase().includes(needle) || child.file.toLowerCase().includes(needle)) {
        children.push(child);
      }
    } else {
      const kept = filterBranch(child, needle);
      if (kept) children.push(kept);
    }
  }
  return children.length > 0 ? { ...branch, children } : null;
}

function getOrCreateBranch(children: TreeItem[], label: string): TreeBranch {
  const existing = children.find(
    (c): c is TreeBranch => c.kind === 'branch' && c.label === label
  );
  if (existing) return existing;
  const created: TreeBranch = { kind: 'branch', label, children: [] };
  children.push(created);
  return created;
}

function humanize(name: string): string {
  return name
    .split(/[_-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
