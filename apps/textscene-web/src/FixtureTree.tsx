/**
 * The collapsible Category → Project → folder → scene tree of the scene-switcher
 * palette, like Godot's FileSystem dock. The palette's `query` filters it by name
 * and path, and branches expand while filtering so matches show.
 */

import { useMemo, useState } from 'react';
import type { Fixture } from './fixtures';
import { buildFixtureTree, filterFixtureTree, type TreeBranch } from './fixtureTree';
import styles from './FixtureTree.module.css';

interface FixtureTreeViewProps {
  fixtures: readonly Fixture[];
  query: string;
  selectedFile: string;
  onSelect: (file: string) => void;
}

export function FixtureTreeView({ fixtures, query, selectedFile, onSelect }: FixtureTreeViewProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());

  const fullTree = useMemo(() => buildFixtureTree(fixtures), [fixtures]);
  const tree = useMemo(() => filterFixtureTree(fullTree, query), [fullTree, query]);
  const searching = query.trim() !== '';

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <ul className={styles.tree} role="tree" aria-label="Built-in scenes">
      {tree.length === 0 && <li className={styles.empty}>No scenes match.</li>}
      {tree.map((b) => (
        <Branch
          key={b.label}
          node={b}
          path={b.label}
          depth={0}
          expanded={expanded}
          searching={searching}
          selectedFile={selectedFile}
          onToggle={toggle}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}

interface BranchProps {
  node: TreeBranch;
  path: string;
  depth: number;
  expanded: ReadonlySet<string>;
  searching: boolean;
  selectedFile: string;
  onToggle: (key: string) => void;
  onSelect: (file: string) => void;
}

function Branch({
  node,
  path,
  depth,
  expanded,
  searching,
  selectedFile,
  onToggle,
  onSelect,
}: BranchProps) {
  const isOpen = searching || expanded.has(path);
  return (
    <li role="treeitem" aria-expanded={isOpen}>
      <button
        type="button"
        className={styles.branch}
        style={{ paddingLeft: depth * 14 + 8 }}
        onClick={() => onToggle(path)}
      >
        {isOpen ? '▾' : '▸'} {node.label}
      </button>
      {isOpen && (
        <ul role="group">
          {node.children.map((child) =>
            child.kind === 'branch' ? (
              <Branch
                key={child.label}
                node={child}
                path={`${path}/${child.label}`}
                depth={depth + 1}
                expanded={expanded}
                searching={searching}
                selectedFile={selectedFile}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            ) : (
              <li key={child.file} role="treeitem">
                <button
                  type="button"
                  aria-current={child.file === selectedFile}
                  className={child.file === selectedFile ? styles.sceneActive : styles.scene}
                  style={{ paddingLeft: (depth + 1) * 14 + 8 }}
                  onClick={() => onSelect(child.file)}
                >
                  {child.label}
                </button>
              </li>
            )
          )}
        </ul>
      )}
    </li>
  );
}
