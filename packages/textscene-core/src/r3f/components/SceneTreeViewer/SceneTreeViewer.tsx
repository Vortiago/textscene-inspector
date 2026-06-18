/**
 * Interactive scene-tree panel. Reads `sceneGraph` from `<HierarchyContext>`
 * and selection state from `<SelectionContext>`. Replaces the imperative
 * `packages/textscene-core/src/ui/SceneTreeViewer.ts`.
 */
import { useCallback, useMemo, useState, type ChangeEvent } from 'react';
import type { TscnNode, TscnExternalResource } from '../../../parser/types.js';
import { useHierarchy } from '../../contexts/HierarchyContext.js';
import { useSelection } from '../../contexts/SelectionContext.js';
import { useResourceLoader } from '../../../resources/useResource.js';
import { liveTreeContext, useLiveTreeVersion } from '../../useLiveSceneTree.js';
import { walkLiveTree } from '../../liveSceneTree.js';
import { TreeNode } from './TreeNode.js';
import styles from './SceneTreeViewer.module.css';

export interface SceneTreeViewerProps {
  /** Optional callback fired when a tree row is double-clicked (host can jump to source). */
  onNodeReveal?: (path: string, node: TscnNode) => void;
  onOpenSubScene?: (scenePath: string) => void;
}

export function SceneTreeViewer({ onNodeReveal, onOpenSubScene }: SceneTreeViewerProps) {
  const { sceneGraph } = useHierarchy();
  const { setExpandedNodePaths, hiddenNodePaths, toggleHidden } = useSelection();
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
    // `version` re-runs the search once a sub-scene/GLB finishes loading.
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
              onToggleVisibility={toggleHidden}
              onNodeReveal={onNodeReveal}
              onOpenSubScene={onOpenSubScene}
              matches={matches}
              externalResources={externalResources}
            />
          ))
        )}
      </div>
    </div>
  );
}
