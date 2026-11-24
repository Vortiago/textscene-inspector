import { useCallback, useMemo, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import * as logger from '../../../logger.js';
import { getAncestorPaths } from '../../../utils/nodePath.js';
import { useHierarchy } from '../../contexts/HierarchyContext.js';
import { useExpandedPaths, useExpandedRowActions } from '../TscnPreviewShell/expandedRows.js';
import { useSelectPath, useSelectedPath } from '../TscnPreviewShell/previewSelection.js';
import { useSceneRead } from '../TscnPreviewShell/sceneRead.js';
import { ROOT_VISIBILITY, TreeNode } from './TreeNode.js';
import { rowsOf, treeRowsOf, type TreeRow } from './treeRows.js';
import { useRowVisibility } from './rowVisibility.js';
import styles from './SceneTreeViewer.module.css';

/**
 * `data-node-path` lives on the outer `.node` wrapper, not the treeitem: a
 * copy on the treeitem breaks every `[data-node-path="X"]` query that
 * expects one match per row.
 */
function nodePathFor(row: HTMLElement): string | null {
  return row.closest<HTMLElement>('[data-node-path]')?.dataset.nodePath ?? null;
}

export interface SceneTreeViewerProps {
  /** Fired when a row is double-clicked, with its live path and name, so the host can jump to the source. */
  onNodeReveal?: (path: string, name: string) => void;
  onOpenSubScene?: (scenePath: string) => void;
}

export function SceneTreeViewer({ onNodeReveal, onOpenSubScene }: SceneTreeViewerProps) {
  const { sceneGraph, scene } = useHierarchy();
  const expandedPaths = useExpandedPaths();
  const expandedRows = useExpandedRowActions();
  const selectedNodePath = useSelectedPath();
  const selectPath = useSelectPath();
  const root = useSceneRead(scene, treeRowsOf);
  const visibility = useRowVisibility(scene, root);
  // The eye calls `set_visible` on the node (scene_tree_editor.cpp:241-247).
  const setVisible = useCallback((row: TreeRow, visible: boolean) => {
    row.node.set('visible', visible).then(
      (isWritten) => isWritten || logger.warn(`[SceneTreeViewer] ${row.path} refused visible`),
      (error: unknown) => logger.warn(`[SceneTreeViewer] the eye did not write ${row.path}`, error)
    );
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const listedRows = useMemo(() => rowsOf(root), [root]);

  const term = searchTerm.trim().toLowerCase();

  // `matchingPaths` holds every match and its ancestors, and null means no search.
  const matchingPaths = useMemo<ReadonlySet<string> | null>(() => {
    if (!term) return null;
    const found = new Set<string>();
    for (const { name, type, path } of listedRows) {
      if (!name.toLowerCase().includes(term) && !type.toLowerCase().includes(term)) continue;
      found.add(path);
      for (let slash = path.lastIndexOf('/'); slash > 0; slash = path.lastIndexOf('/', slash - 1)) {
        found.add(path.slice(0, slash));
      }
    }
    return found;
  }, [term, listedRows]);

  const matches = useCallback(
    (path: string): boolean => matchingPaths === null || matchingPaths.has(path),
    [matchingPaths]
  );

  const handleExpandAll = useCallback(() => {
    expandedRows.set(new Set(listedRows.map((row) => row.path)));
  }, [listedRows, expandedRows]);

  const handleSearchChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  // The WAI-ARIA APG Tree View keyboard pattern, delegated from the container.
  // Arrow keys move focus and selection together, since the app has no
  // focused-but-unselected state, so the roving tab stop follows the selection.
  const handleTreeKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const currentRow = (e.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]');
      if (!currentRow) return;

      const allRows = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="treeitem"]'));
      const index = allRows.indexOf(currentRow);
      if (index === -1) return;

      const focusAndSelect = (row: HTMLElement | null | undefined) => {
        if (!row) return;
        row.focus();
        const path = nodePathFor(row);
        if (path) selectPath(path);
      };

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          focusAndSelect(allRows[index + 1]);
          break;
        case 'ArrowUp':
          e.preventDefault();
          focusAndSelect(allRows[index - 1]);
          break;
        case 'ArrowRight': {
          e.preventDefault();
          const expanded = currentRow.getAttribute('aria-expanded');
          if (expanded === 'false') {
            const path = nodePathFor(currentRow);
            if (path) expandedRows.toggle(path);
          } else if (expanded === 'true') {
            focusAndSelect(allRows[index + 1]);
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          const expanded = currentRow.getAttribute('aria-expanded');
          const path = nodePathFor(currentRow);
          if (expanded === 'true') {
            if (path) expandedRows.toggle(path);
          } else if (path) {
            // The parent is the nearest ancestor path, not TreeNode's private DOM
            // nesting. A root row has none.
            const parentPath = getAncestorPaths(path).pop();
            if (parentPath) {
              focusAndSelect(allRows.find((row) => nodePathFor(row) === parentPath));
            }
          }
          break;
        }
        case 'Home':
          e.preventDefault();
          focusAndSelect(allRows[0]);
          break;
        case 'End':
          e.preventDefault();
          focusAndSelect(allRows[allRows.length - 1]);
          break;
        default:
          break;
      }
    },
    [selectPath, expandedRows]
  );

  // The selected row is the tab stop only while it renders, that is while it
  // survives the search and every ancestor is expanded. Otherwise the first
  // root row is, or Tab would skip the tree.
  const selectedRowRendered =
    selectedNodePath !== null &&
    matches(selectedNodePath) &&
    getAncestorPaths(selectedNodePath).every((p) => expandedPaths.has(p));

  const hasNodes = (sceneGraph?.scenes.get(sceneGraph.rootScene)?.nodes.length ?? 0) > 0;
  if (sceneGraph === null || (hasNodes && !root)) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>Loading scene…</div>
      </div>
    );
  }

  const shownRoot = root && matches(root.path) ? root : null;

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
          className={`${styles.controlBtn} ${styles.iconBtn}`}
          onClick={handleExpandAll}
          aria-label="Expand all"
          title="Expand all"
        >
          <span aria-hidden="true">⊞</span>
        </button>
        <button
          type="button"
          className={`${styles.controlBtn} ${styles.iconBtn}`}
          onClick={expandedRows.clear}
          aria-label="Collapse all"
          title="Collapse all"
        >
          <span aria-hidden="true">⊟</span>
        </button>
      </div>

      <div className={styles.tree} role="tree" aria-label="Scene tree" onKeyDown={handleTreeKeyDown}>
        {!root ? (
          <div className={styles.empty}>No nodes to display</div>
        ) : !shownRoot ? (
          <div className={styles.empty}>No nodes match &ldquo;{searchTerm}&rdquo;</div>
        ) : (
          <TreeNode
            row={shownRoot}
            depth={0}
            parentVisibility={ROOT_VISIBILITY}
            visibility={visibility}
            onToggleVisibility={setVisible}
            onNodeReveal={onNodeReveal}
            onOpenSubScene={onOpenSubScene}
            matches={matches}
            isDefaultFocusable={!selectedRowRendered}
          />
        )}
      </div>
    </div>
  );
}
