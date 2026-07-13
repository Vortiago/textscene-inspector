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
import { collapseLiveNode, liveChildGroups, singleSceneCache, type LiveChildGroup } from '../../liveSceneTree.js';
import { GLB_SCENE_ROOT_TYPE } from '../../internal/glb-scene-root/Component.js';
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
  /**
   * #224 (roving tabIndex, WAI-ARIA APG Tree View pattern): true ONLY for
   * the first root-level row, and only while no SELECTED row is rendered
   * (nothing selected, or the selection collapsed/filtered out of view) —
   * `<SceneTreeViewer>` computes that condition; every recursively-rendered
   * child defaults to false and never sets this.
   */
  isDefaultFocusable?: boolean;
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
  isDefaultFocusable = false,
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

  // GLB internal hierarchy: a `GLBSceneRoot` row's children are the loaded
  // GLB's THREE.Object3D nodes, walked into synthetic TscnNodes. Returns null
  // for non-GLB rows; the hook re-renders when the GLB arrives.
  const glbChildren = useGlbChildren(node);

  // liveChildGroups — the single origin-tagged source of truth for what lives
  // below this node and in what resource scope. Replaces the old
  // `mergedChildren`/`inlineChildren`/`dynamicChildren` three-way branch.
  //
  // The pure `liveChildGroups` function needs the loaded data the hooks
  // already fetched:
  //   - sub-scene: hand a singleSceneCache keyed to scenePath + the loaded
  //     sub-scene (`subScene` already has the `{ nodes, externalResources }`
  //     shape the cache expects).
  //   - GLB: for GLBSceneRoot nodes, the hook already computed the synthetic
  //     TscnNode list; return a glb group directly to avoid re-walking the
  //     THREE.Object3D tree (glbSceneRootChildren is idempotent but the hook
  //     result is already memoized by useGlbChildren).
  //
  // Memoized so a collapsed row keeps stable group identity across unrelated
  // re-renders (selection/hover/expand), mirroring the former collapseLiveNode memo.
  const groups: readonly LiveChildGroup[] = useMemo(() => {
    if (node.type === GLB_SCENE_ROOT_TYPE && glbChildren) {
      return [{ origin: 'glb' as const, children: glbChildren, externalResources }];
    }
    return liveChildGroups(node, externalResources, singleSceneCache(scenePath, subScene));
  }, [node, externalResources, scenePath, subScene, glbChildren]);

  // Instance root merge (ADR-0013) via collapseLiveNode — the SAME decision the
  // viewport, inspector, and panels make. Used here to derive the effective type
  // and properties for the row header (badge + transform icon). Memoized so an
  // unrelated re-render doesn't re-merge this instance's subtree every frame.
  const effective = useMemo(
    () => collapseLiveNode(node, externalResources, singleSceneCache(scenePath, subScene)),
    [node, externalResources, scenePath, subScene]
  );

  const hasChildren = groups.some((g) => g.children.length > 0);

  // One child row. `keyPrefix` is the group's origin — `merged`, `inline`,
  // `subscene`, or `glb` — keeping each group's children in its own React key
  // namespace so a name collision (an inline child sharing a name with a
  // sub-scene root) doesn't trip React's duplicate-key warning. `childRes` is
  // the resource scope the child resolves its OWN instance ref against, taken
  // directly from the group rather than re-computed.
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

  // #224 roving tabIndex: this row is the tree's ONE tab stop when it's
  // selected, or when it's the designated fallback row (the first root row,
  // set by SceneTreeViewer only while no selected row is rendered).
  const isRovingTabStop = isSelected || isDefaultFocusable;

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
        tabIndex={isRovingTabStop ? 0 : -1}
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
          {groups.flatMap((group) =>
            group.children
              .filter((child) => matches(joinPath(nodePath, child.name)))
              .map((child) => renderChildRow(child, group.origin, group.externalResources))
          )}
        </div>
      )}
    </div>
  );
}

export const TreeNode = memo(TreeNodeImpl);
