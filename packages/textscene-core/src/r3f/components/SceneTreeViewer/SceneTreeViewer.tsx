/**
 * Interactive scene-tree panel. Reads `sceneGraph` from `<HierarchyContext>`
 * and selection state from `<SelectionContext>`. Replaces the imperative
 * `packages/textscene-core/src/ui/SceneTreeViewer.ts`.
 */
import { useCallback, useMemo, useState, type ChangeEvent } from 'react';
import type { TscnNode } from '../../../parser/types.js';
import { joinPath } from '../../../utils/nodePath.js';
import { useHierarchy } from '../../contexts/HierarchyContext.js';
import { useSelection } from '../../contexts/SelectionContext.js';
import { TreeNode } from './TreeNode.js';
import styles from './SceneTreeViewer.module.css';

export interface SceneTreeViewerProps {
  /** Optional callback fired when a tree row is double-clicked (host can jump to source). */
  onNodeReveal?: (path: string, node: TscnNode) => void;
}

function collectAllPaths(nodes: readonly TscnNode[], parentPath: string, out: Set<string>): void {
  for (const node of nodes) {
    const nodePath = joinPath(parentPath, node.name);
    if (node.children.length > 0) {
      out.add(nodePath);
      collectAllPaths(node.children, nodePath, out);
    }
  }
}

function nodeMatchesSearch(node: TscnNode, term: string): boolean {
  if (!term) return true;
  if (node.name.toLowerCase().includes(term)) return true;
  if (node.type.toLowerCase().includes(term)) return true;
  return node.children.some((child) => nodeMatchesSearch(child, term));
}

export function SceneTreeViewer({ onNodeReveal }: SceneTreeViewerProps) {
  const { sceneGraph } = useHierarchy();
  const { setExpandedNodePaths } = useSelection();

  const [searchTerm, setSearchTerm] = useState('');
  const [hiddenNodePaths, setHiddenNodePaths] = useState<ReadonlySet<string>>(
    () => new Set<string>()
  );

  const rootNodes = useMemo<readonly TscnNode[]>(() => {
    if (!sceneGraph) return [];
    return sceneGraph.scenes.get(sceneGraph.rootScene)?.nodes ?? [];
  }, [sceneGraph]);

  const term = searchTerm.trim().toLowerCase();

  const matches = useCallback(
    (node: TscnNode): boolean => nodeMatchesSearch(node, term),
    [term]
  );

  const handleExpandAll = useCallback(() => {
    const all = new Set<string>();
    collectAllPaths(rootNodes, '', all);
    setExpandedNodePaths(all);
  }, [rootNodes, setExpandedNodePaths]);

  const handleCollapseAll = useCallback(() => {
    setExpandedNodePaths(new Set());
  }, [setExpandedNodePaths]);

  const handleToggleVisibility = useCallback((path: string) => {
    setHiddenNodePaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleSearchChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  if (sceneGraph === null) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>Loading scene…</div>
      </div>
    );
  }

  const visibleRoots = rootNodes.filter(matches);

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <input
          type="search"
          className={styles.search}
          placeholder="Search nodes…"
          value={searchTerm}
          onChange={handleSearchChange}
          aria-label="Search nodes"
        />
        <button
          type="button"
          className={styles.controlBtn}
          onClick={handleExpandAll}
          aria-label="Expand all"
          title="Expand all"
        >
          Expand
        </button>
        <button
          type="button"
          className={styles.controlBtn}
          onClick={handleCollapseAll}
          aria-label="Collapse all"
          title="Collapse all"
        >
          Collapse
        </button>
      </div>

      <div className={styles.tree} role="tree" aria-label="Scene tree">
        {rootNodes.length === 0 ? (
          <div className={styles.empty}>No nodes to display</div>
        ) : visibleRoots.length === 0 ? (
          <div className={styles.empty}>No nodes match &ldquo;{searchTerm}&rdquo;</div>
        ) : (
          visibleRoots.map((node) => (
            <TreeNode
              key={node.name}
              node={node}
              parentPath=""
              depth={0}
              hiddenNodePaths={hiddenNodePaths}
              onToggleVisibility={handleToggleVisibility}
              onNodeReveal={onNodeReveal}
              matches={matches}
            />
          ))
        )}
      </div>
    </div>
  );
}
