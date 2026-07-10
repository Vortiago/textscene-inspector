/**
 * Single tree row (header + recursive children container). Internal to
 * `<SceneTreeViewer>` — not exported from the package.
 */
import { memo, useMemo, type MouseEvent } from 'react';
import type { TscnNode, TscnExternalResource } from '../../../parser/types.js';
import { joinPath } from '../../../utils/nodePath.js';
import { isRenderableNodeType } from '../../nodeSupport.js';
import { useSelection } from '../../contexts/SelectionContext.js';
import { resolveInstancePath } from '../../../resources/SubResourceResolver.js';
import { collapseLiveNode, singleSceneCache } from '../../liveSceneTree.js';
import { useSubSceneChildren } from './useSubSceneChildren.js';
import { useGlbChildren } from './useGlbChildren.js';
import styles from './SceneTreeViewer.module.css';

const TYPE_BADGE_CLASS: Record<string, string> = {
  Node3D: styles.typeNode3d!,
  MeshInstance3D: styles.typeMesh!,
  Camera3D: styles.typeCamera!,
  Light3D: styles.typeLight!,
  SpotLight3D: styles.typeLight!,
  DirectionalLight3D: styles.typeLight!,
  OmniLight3D: styles.typeLight!,
  AreaLight3D: styles.typeLight!,
};

const TYPE_SHORTHAND: Record<string, string> = {
  Node3D: 'N3D',
  MeshInstance3D: 'Mesh',
  Camera3D: 'Cam',
  Light3D: 'Light',
  SpotLight3D: 'Spot',
  DirectionalLight3D: 'Dir',
  OmniLight3D: 'Omni',
  AreaLight3D: 'Area',
};

function getTypeBadgeClass(type: string): string {
  return TYPE_BADGE_CLASS[type] ?? styles.typeUnknown!;
}

function getTypeShorthand(type: string): string {
  return TYPE_SHORTHAND[type] ?? type.substring(0, 4);
}

function hasTransform(node: TscnNode): boolean {
  return 'transform' in node.properties && node.properties.transform !== undefined;
}

export interface TreeNodeProps {
  node: TscnNode;
  parentPath: string;
  depth: number;
  hiddenNodePaths: ReadonlySet<string>;
  onToggleVisibility: (path: string) => void;
  onNodeReveal?: (path: string, node: TscnNode) => void;
  /**
   * Open an instanced sub-scene as its own previewed scene (≈ Godot's
   * "Open in Editor"). Receives the resolved `res://` path of the instance.
   */
  onOpenSubScene?: (scenePath: string) => void;
  /**
   * Whether a row at the given full node-path should be visible under the
   * current search — path-based (resolved over the live tree by
   * `SceneTreeViewer`) so a match inside an instanced sub-scene keeps its
   * ancestor rows visible.
   */
  matches: (path: string) => boolean;
  /**
   * WI-HALL-1: the host scene's externalResources, used to resolve
   * `node.instance = ExtResource("id")` references against the
   * `res://` path of the referenced PackedScene. Threaded down from
   * `SceneTreeViewer` so every TreeNode can attempt sub-scene
   * resolution without re-reading HierarchyContext.
   */
  externalResources: readonly TscnExternalResource[];
}

function TreeNodeImpl({
  node,
  parentPath,
  depth,
  hiddenNodePaths,
  onToggleVisibility,
  onNodeReveal,
  onOpenSubScene,
  matches,
  externalResources,
}: TreeNodeProps) {
  const nodePath = joinPath(parentPath, node.name);
  const scenePath = node.instance
    ? resolveInstancePath(node.instance, externalResources)
    : null;
  const instanceScenePath = onOpenSubScene ? scenePath : null;

  // WI-HALL-1: dynamically-loaded sub-scene children (when this node
  // has `instance = ExtResource("...")`). Returns null for non-instance
  // rows or while the sub-scene is still loading; treated as an empty
  // list for rendering. The `useResource` hook inside subscribes to the
  // scene event bus, so the tree re-renders automatically when the
  // sub-scene arrives.
  const subScene = useSubSceneChildren(node, externalResources);
  const subSceneChildren = subScene?.nodes ?? null;
  // Sub-scene (and merged) children resolve their own instance refs against the
  // LOADED sub-scene's resource table — not this outer scene's — so a nested
  // instance (e.g. the GLB inside player.tscn) resolves instead of dead-ending.
  const childResources = subScene?.externalResources ?? externalResources;

  // GLB internal hierarchy: a `GLBSceneRoot` row's children are the loaded
  // GLB's THREE.Object3D nodes, walked into synthetic TscnNodes. Returns null
  // for non-GLB rows; the hook re-renders when the GLB arrives.
  const glbChildren = useGlbChildren(node);

  // Instance root merge (ADR-0013) via the shared `collapseLiveNode` — the SAME
  // decision the viewport, inspector, and panels make, so the rule lives in ONE
  // place rather than being re-derived per walker (the recurring source of the
  // "node inside an instance is wrong/invisible" bug class). `singleSceneCache`
  // hands it just this row's loaded sub-scene, keyed to its path; it returns a
  // merged node for a single non-GLB root (adopting the root's type + children),
  // or `node` itself for `.glb`/multi-root/not-yet-loaded (the historical inline
  // + sub-scene split below). The 📦 badge + ⤢ open-standalone affordance stay,
  // driven by this node's own `instance` ref.
  // Memoized so a collapsed row keeps a stable identity across unrelated
  // re-renders (selection/hover/expand). Without it, each render allocates a
  // fresh `effective.children` array and hands child rows new-identity `node`
  // props, defeating the `memo` on this component for collapsed subtrees.
  const effective = useMemo(
    () =>
      collapseLiveNode(
        node,
        externalResources,
        singleSceneCache(scenePath, subSceneChildren ? { nodes: subSceneChildren } : null)
      ),
    [node, scenePath, subSceneChildren, externalResources]
  );
  const didCollapse = effective !== node;

  const inlineChildren = node.children;
  const dynamicChildren = subSceneChildren ?? glbChildren ?? [];
  const mergedChildren = didCollapse ? effective.children : null;
  const hasChildren = mergedChildren
    ? mergedChildren.length > 0
    : inlineChildren.length > 0 || dynamicChildren.length > 0;

  // One child row. `keyPrefix` keeps inline vs sub-scene keys in separate
  // namespaces so a name collision (an inline child sharing a name with a
  // sub-scene root) doesn't trip React's duplicate-key warning. `childRes` is
  // the resource scope the child resolves its OWN instance ref against — the
  // loaded sub-scene's for merged/sub-scene rows, this scene's for inline rows.
  const renderChildRow = (
    child: TscnNode,
    keyPrefix: string,
    childRes: readonly TscnExternalResource[]
  ) => (
    <TreeNode
      key={`${keyPrefix}:${child.name}`}
      node={child}
      parentPath={nodePath}
      depth={depth + 1}
      hiddenNodePaths={hiddenNodePaths}
      onToggleVisibility={onToggleVisibility}
      onNodeReveal={onNodeReveal}
      onOpenSubScene={onOpenSubScene}
      matches={matches}
      externalResources={childRes}
    />
  );

  const {
    selectedNodePath,
    expandedNodePaths,
    setSelectedNodePath,
    hoverStore,
    toggleExpandedNodePath,
  } = useSelection();

  const isExpanded = expandedNodePaths.has(nodePath);
  const isSelected = selectedNodePath === nodePath;
  const isHidden = hiddenNodePaths.has(nodePath);

  const isUnsupported = !isRenderableNodeType(effective.type);

  const headerClasses = [styles.header];
  if (isSelected) headerClasses.push(styles.selected!);
  if (isHidden) headerClasses.push(styles.hidden!);
  if (isUnsupported) headerClasses.push(styles.unsupported!);

  function handleExpand(e: MouseEvent) {
    e.stopPropagation();
    toggleExpandedNodePath(nodePath);
  }

  function handleSelect() {
    setSelectedNodePath(nodePath);
  }

  function handleDoubleClick() {
    onNodeReveal?.(nodePath, node);
  }

  function handleMouseEnter() {
    hoverStore.set(nodePath);
  }

  function handleMouseLeave() {
    hoverStore.set(null);
  }

  function handleToggleVisibility(e: MouseEvent) {
    e.stopPropagation();
    onToggleVisibility(nodePath);
  }


  return (
    <div className={styles.node} data-node-path={nodePath} data-depth={depth}>
      <div
        className={headerClasses.join(' ')}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleSelect}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isExpanded : undefined}
      >
        {hasChildren ? (
          <span
            className={styles.expandIcon}
            onClick={handleExpand}
            role="button"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '▼' : '▶'}
          </span>
        ) : (
          <span className={styles.expandSpacer}>•</span>
        )}

        <span
          className={`${styles.typeBadge} ${getTypeBadgeClass(effective.type)}`}
          title={effective.type}
        >
          {getTypeShorthand(effective.type)}
        </span>

        {isUnsupported && (
          <span
            className={styles.notImplementedBadge}
            title={`${effective.type} is not yet supported by the renderer`}
          >
            Not Implemented
          </span>
        )}

        <span className={styles.nodeName}>{node.name}</span>

        <span className={styles.glyphs}>
          {hasTransform(effective) && (
            <span className={styles.transformIcon} title="Has transform">
              ⌖
            </span>
          )}

          {node.instance && (
            <span
              className={styles.instanceIcon}
              title={`External scene: ${node.instance}`}
            >
              📦
            </span>
          )}
          {instanceScenePath && (
            <button
              type="button"
              className={styles.openSubSceneIcon}
              onClick={(e) => {
                e.stopPropagation();
                onOpenSubScene?.(instanceScenePath);
              }}
              title="Open this sub-scene on its own"
              aria-label="Open sub-scene standalone"
            >
              ⤢
            </button>
          )}

          <button
            type="button"
            className={styles.visibilityIcon}
            onClick={handleToggleVisibility}
            title={isHidden ? 'Click to show' : 'Click to hide'}
            aria-label={isHidden ? 'Show node' : 'Hide node'}
          >
            {isHidden ? '🙈' : '👁️'}
          </button>
        </span>
      </div>

      {hasChildren && isExpanded && (
        <div className={styles.children} role="group">
          {mergedChildren
            ? // Collapsed instance root: one combined child list (the root's
              // own children followed by any host-added children), addressed
              // directly under this row — no synthetic wrapper segment. The
              // merged children come from the loaded sub-scene, so they resolve
              // against its resources.
              mergedChildren
                .filter((child) => matches(joinPath(nodePath, child.name)))
                .map((child) => renderChildRow(child, 'merged', childResources))
            : [
                ...inlineChildren
                  .filter((child) => matches(joinPath(nodePath, child.name)))
                  .map((child) => renderChildRow(child, 'inline', externalResources)),
                ...dynamicChildren
                  .filter((child) => matches(joinPath(nodePath, child.name)))
                  .map((child) => renderChildRow(child, 'subscene', childResources)),
              ]}
        </div>
      )}
    </div>
  );
}

export const TreeNode = memo(TreeNodeImpl);
