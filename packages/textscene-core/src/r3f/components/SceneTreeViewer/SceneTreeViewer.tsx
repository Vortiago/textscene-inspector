/**
 * Interactive scene-tree panel. Reads `sceneGraph` from `<HierarchyContext>`
 * and selection state from `<SelectionContext>`. Replaces the imperative
 * `packages/textscene-core/src/ui/SceneTreeViewer.ts`.
 */
import { useCallback, useMemo, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import type { TscnNode, TscnExternalResource } from '../../../parser/types.js';
import { getAncestorPaths } from '../../../utils/nodePath.js';
import { useHierarchy } from '../../contexts/HierarchyContext.js';
import { useSelection } from '../../contexts/SelectionContext.js';
import { useResourceLoader } from '../../../resources/useResource.js';
import { liveTreeContext, useLiveTreeVersion } from '../../useLiveSceneTree.js';
import { walkLiveTree } from '../../liveSceneTree.js';
import { TreeNode } from './TreeNode.js';
import styles from './SceneTreeViewer.module.css';

/**
 * The node path for a treeitem row. `data-node-path` lives on the OUTER
 * `.node` wrapper (also used elsewhere to look up a row by path), not the
 * treeitem div itself — duplicating it onto the treeitem would break every
 * `[data-node-path="X"]` query that assumes exactly one match per row.
 */
function nodePathFor(row: HTMLElement): string | null {
  return row.closest<HTMLElement>('[data-node-path]')?.dataset.nodePath ?? null;
}

export interface SceneTreeViewerProps {
  /** Optional callback fired when a tree row is double-clicked (host can jump to source). */
  onNodeReveal?: (path: string, node: TscnNode) => void;
  onOpenSubScene?: (scenePath: string) => void;
}

export function SceneTreeViewer({ onNodeReveal, onOpenSubScene }: SceneTreeViewerProps) {
  const { sceneGraph } = useHierarchy();
  const {
    selectedNodePath,
    expandedNodePaths,
    setExpandedNodePaths,
    hiddenNodePaths,
    toggleHidden,
    setSelectedNodePath,
    toggleExpandedNodePath,
  } = useSelection();
  const loader = useResourceLoader();
  const version = useLiveTreeVersion(loader);

  const [searchTerm, setSearchTerm] = useState('');

  const rootNodes = useMemo<readonly TscnNode[]>(() => {
    if (!sceneGraph) return [];
    return sceneGraph.scenes.get(sceneGraph.rootScene)?.nodes ?? [];
  }, [sceneGraph]);

  // WI-HALL-1: the root scene's externalResources are how
  // `node.instance = ExtResource("id")` references get resolved to a
  // `res://` path. Threaded into every TreeNode so each row can
  // attempt sub-scene resolution on its own without re-reading the
  // sceneGraph.
  const externalResources = useMemo<readonly TscnExternalResource[]>(() => {
    if (!sceneGraph) return [];
    return sceneGraph.scenes.get(sceneGraph.rootScene)?.externalResources ?? [];
  }, [sceneGraph]);

  const term = searchTerm.trim().toLowerCase();

  // Search + expand resolve over the LIVE tree (collapsed instances, loaded
  // sub-scenes, GLB internals) — the same rows the tree renders — so a node
  // inside an instance is reachable, not just root-scene nodes. `matchingPaths`
  // is the set of paths to keep visible: every match plus its ancestors (so the
  // path to a match shows). null = no search (show everything). Recomputed as
  // sub-scenes/GLBs stream in (the live-tree version tick).
  const matchingPaths = useMemo<ReadonlySet<string> | null>(() => {
    if (!term) return null;
    const lt = liveTreeContext(sceneGraph, loader);
    if (!lt) return new Set<string>();
    const found = new Set<string>();
    walkLiveTree(lt.roots, lt.ctx, ({ node, path }) => {
      if (node.name.toLowerCase().includes(term) || node.type.toLowerCase().includes(term)) {
        found.add(path);
        for (let slash = path.lastIndexOf('/'); slash > 0; slash = path.lastIndexOf('/', slash - 1)) {
          found.add(path.slice(0, slash));
        }
      }
    });
    return found;
    // `version` is an intentional cache-buster: it increments each time a
    // sub-scene or GLB finishes loading so the search result updates to include
    // newly-visible nodes. The value itself is not read inside the callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, sceneGraph, loader, version]);

  const matches = useCallback(
    (path: string): boolean => matchingPaths === null || matchingPaths.has(path),
    [matchingPaths]
  );

  const handleExpandAll = useCallback(() => {
    const lt = liveTreeContext(sceneGraph, loader);
    if (!lt) return;
    const all = new Set<string>();
    walkLiveTree(lt.roots, lt.ctx, ({ path }) => all.add(path));
    setExpandedNodePaths(all);
  }, [sceneGraph, loader, setExpandedNodePaths]);

  const handleCollapseAll = useCallback(() => {
    setExpandedNodePaths(new Set());
  }, [setExpandedNodePaths]);

  const handleSearchChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  // #224: WAI-ARIA APG Tree View keyboard pattern. One handler on the tree
  // container (event delegation) instead of one per row. Arrow keys move
  // focus AND selection together — this app has no separate "focused but
  // unselected" concept, so treating them as one keeps the roving-tabIndex
  // row in TreeNode.tsx in sync for free.
  const handleTreeKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const currentRow = (e.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]');
      if (!currentRow) return;

      const allRows = Array.from(
        e.currentTarget.querySelectorAll<HTMLElement>('[role="treeitem"]')
      );
      const index = allRows.indexOf(currentRow);
      if (index === -1) return;

      const focusAndSelect = (row: HTMLElement | null | undefined) => {
        if (!row) return;
        row.focus();
        const path = nodePathFor(row);
        if (path) setSelectedNodePath(path);
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
            if (path) toggleExpandedNodePath(path);
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
            if (path) toggleExpandedNodePath(path);
          } else if (path) {
            // Move to the parent row via the slash-joined path model the
            // whole handler already leans on (rather than walking TreeNode's
            // private DOM nesting): the nearest ancestor path is the parent;
            // a root row has none.
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
    [setSelectedNodePath, toggleExpandedNodePath]
  );

  // #224 roving tabIndex: the selected row is normally the tree's one tab
  // stop, but only while it is actually RENDERED — collapsing an ancestor or
  // filtering it out via search unmounts it, and without a fallback every
  // remaining row would be tabIndex -1 (Tab would skip the tree entirely).
  // A row renders iff it survives the search filter and every ancestor is
  // expanded — the same conditions TreeNode's recursion applies.
  const selectedRowRendered =
    selectedNodePath !== null &&
    matches(selectedNodePath) &&
    getAncestorPaths(selectedNodePath).every((p) => expandedNodePaths.has(p));

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
          onClick={handleCollapseAll}
          aria-label="Collapse all"
          title="Collapse all"
        >
          <span aria-hidden="true">⊟</span>
        </button>
      </div>

      <div
        className={styles.tree}
        role="tree"
        aria-label="Scene tree"
        onKeyDown={handleTreeKeyDown}
      >
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
              hiddenNodePaths={hiddenNodePaths}
              onToggleVisibility={toggleHidden}
              onNodeReveal={onNodeReveal}
              onOpenSubScene={onOpenSubScene}
              matches={matches}
              externalResources={externalResources}
              isDefaultFocusable={index === 0 && !selectedRowRendered}
            />
          ))
        )}
      </div>
    </div>
  );
}
