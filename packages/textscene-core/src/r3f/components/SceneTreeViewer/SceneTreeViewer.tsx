import { useCallback, useMemo, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import * as logger from '../../../logger.js';
import type { TscnNode, TscnExternalResource } from '../../../parser/types.js';
import { getAncestorPaths } from '../../../utils/nodePath.js';
import { useHierarchy } from '../../contexts/HierarchyContext.js';
import { useExpandedPaths, useExpandedRowActions } from '../TscnPreviewShell/expandedRows.js';
import { useSelectPath, useSelectedPath } from '../TscnPreviewShell/previewSelection.js';
import { absolutePathOf } from '../../../scene/nodePathWalk.js';
import { useSeatedRoots, useSharedLiveTree } from '../../useLiveSceneTree.js';
import { walkLiveTree, type LiveTreeEntry } from '../../liveSceneTree.js';
import { dockListsChild } from '../../dockListing.js';
import { ROOT_VISIBILITY, TreeNode } from './TreeNode.js';
import styles from './SceneTreeViewer.module.css';

/**
 * `data-node-path` lives on the outer `.node` wrapper, not the treeitem: a
 * copy on the treeitem breaks every `[data-node-path="X"]` query that
 * expects one match per row.
 */
function nodePathFor(row: HTMLElement): string | null {
  return row.closest<HTMLElement>('[data-node-path]')?.dataset.nodePath ?? null;
}

const NO_NODES: readonly TscnNode[] = [];
const NO_PATHS: readonly string[] = [];

export interface SceneTreeViewerProps {
  /** Fired when a row is double-clicked, so the host can jump to the source. */
  onNodeReveal?: (path: string, node: TscnNode) => void;
  onOpenSubScene?: (scenePath: string) => void;
}

export function SceneTreeViewer({ onNodeReveal, onOpenSubScene }: SceneTreeViewerProps) {
  const { sceneGraph, scene } = useHierarchy();
  const expandedPaths = useExpandedPaths();
  const expandedRows = useExpandedRowActions();
  const selectedNodePath = useSelectedPath();
  const selectPath = useSelectPath();
  // The eye calls `set_visible` on the node (scene_tree_editor.cpp:241-247).
  const setVisible = useCallback(
    (path: string, visible: boolean) => {
      const node = scene?.getNodeOrNull(absolutePathOf(path));
      if (!node) {
        logger.warn(`[SceneTreeViewer] the eye found no node at ${path}`);
        return;
      }
      node.set('visible', visible).then(
        (isWritten) => isWritten || logger.warn(`[SceneTreeViewer] ${path} refused visible`),
        (error: unknown) => logger.warn(`[SceneTreeViewer] the eye did not write ${path}`, error)
      );
    },
    [scene]
  );
  const liveTree = useSharedLiveTree();

  const [searchTerm, setSearchTerm] = useState('');

  const rootNodes = useSeatedRoots() ?? NO_NODES;

  // Every TreeNode resolves `ExtResource("id")` against these, with no
  // re-read of the sceneGraph.
  const externalResources = useMemo<readonly TscnExternalResource[]>(() => {
    if (!sceneGraph) return [];
    return sceneGraph.scenes.get(sceneGraph.rootScene)?.externalResources ?? [];
  }, [sceneGraph]);

  const editablePaths = sceneGraph?.scenes.get(sceneGraph.rootScene)?.editableInstances ?? NO_PATHS;
  const isListedChild = useCallback(
    (path: string): boolean => !liveTree || dockListsChild(path, liveTree.roots, liveTree.ctx, editablePaths),
    [liveTree, editablePaths]
  );
  // The dock stops at an unlisted node, so a pre-order walk checks a node only below a listed parent.
  const listedEntries = useMemo<readonly LiveTreeEntry[]>(() => {
    if (!liveTree) return [];
    const listed = new Set<string>();
    const entries: LiveTreeEntry[] = [];
    walkLiveTree(liveTree.roots, liveTree.ctx, (entry) => {
      const parent = entry.path.slice(0, Math.max(entry.path.lastIndexOf('/'), 0));
      const isListed = parent === '' || (listed.has(parent) && isListedChild(entry.path));
      if (!isListed) return;
      listed.add(entry.path);
      entries.push(entry);
    });
    return entries;
  }, [liveTree, isListedChild]);

  const term = searchTerm.trim().toLowerCase();

  // Search and expand walk the live tree, so a node inside an instance is
  // reachable. `matchingPaths` holds every match and its ancestors, and null
  // means no search. It recomputes on each load tick, which gives a new live tree.
  const matchingPaths = useMemo<ReadonlySet<string> | null>(() => {
    if (!term) return null;
    const found = new Set<string>();
    for (const { node, path } of listedEntries) {
      if (!node.name.toLowerCase().includes(term) && !node.type.toLowerCase().includes(term)) continue;
      found.add(path);
      for (let slash = path.lastIndexOf('/'); slash > 0; slash = path.lastIndexOf('/', slash - 1)) {
        found.add(path.slice(0, slash));
      }
    }
    return found;
  }, [term, listedEntries]);

  const matches = useCallback(
    (path: string): boolean => matchingPaths === null || matchingPaths.has(path),
    [matchingPaths]
  );

  const handleExpandAll = useCallback(() => {
    expandedRows.set(new Set(listedEntries.map((entry) => entry.path)));
  }, [listedEntries, expandedRows]);

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

  if (sceneGraph === null) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>Loading scene…</div>
      </div>
    );
  }

  const visibleRoots = rootNodes.filter((node) => matches(node.name));

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
        {rootNodes.length === 0 ? (
          <div className={styles.empty}>No nodes to display</div>
        ) : visibleRoots.length === 0 ? (
          <div className={styles.empty}>No nodes match &ldquo;{searchTerm}&rdquo;</div>
        ) : (
          visibleRoots.map((node, index) => (
            <TreeNode
              key={node.name}
              node={node}
              parentPath=""
              depth={0}
              parentVisibility={ROOT_VISIBILITY}
              onToggleVisibility={setVisible}
              onNodeReveal={onNodeReveal}
              onOpenSubScene={onOpenSubScene}
              matches={matches}
              isListedChild={isListedChild}
              externalResources={externalResources}
              isDefaultFocusable={index === 0 && !selectedRowRendered}
            />
          ))
        )}
      </div>
    </div>
  );
}
