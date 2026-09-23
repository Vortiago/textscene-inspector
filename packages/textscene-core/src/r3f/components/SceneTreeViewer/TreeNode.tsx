/** One tree row and its recursive children, internal to `<SceneTreeViewer>`. */
import { memo, useMemo, type MouseEvent } from 'react';
import type { TscnNode, TscnExternalResource } from '../../../parser/types.js';
import { joinPath } from '../../../utils/nodePath.js';
import { rendersOwnVisual } from '../../nodeSupport.js';
import { useSelection } from '../../contexts/SelectionContext.js';
import { resolveInstancePath } from '../../../resources/SubResourceResolver.js';
import { liveChildGroups, singleSceneCache, type LiveChildGroup } from '../../liveSceneTree.js';
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
  // hasOwn: `type` comes from the file, and a prototype member is not nullish,
  // so `??` would let a function through as a className.
  return (Object.hasOwn(TYPE_BADGE_CLASS, type) ? TYPE_BADGE_CLASS[type] : undefined) ??
    styles.typeUnknown!;
}

function getTypeShorthand(type: string): string {
  return (
    (Object.hasOwn(TYPE_SHORTHAND, type) ? TYPE_SHORTHAND[type] : undefined) ??
    type.substring(0, 4)
  );
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
   * Opens an instanced sub-scene as its own previewed scene, like Godot's
   * "Open in Editor". It receives the instance's resolved `res://` path.
   */
  onOpenSubScene?: (scenePath: string) => void;
  /**
   * Whether the row at this node path survives the search. It is path-based,
   * so a match inside a sub-scene keeps its ancestor rows visible.
   */
  matches: (path: string) => boolean;
  /**
   * The host scene's externalResources, which resolve `ExtResource("id")` to
   * the PackedScene's `res://` path with no re-read of HierarchyContext.
   */
  externalResources: readonly TscnExternalResource[];
  /**
   * True only for the first root row while no selected row renders.
   * `<SceneTreeViewer>` computes it, and a child row never sets it.
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

  // Null for a non-instance row or while the sub-scene loads. The hook
  // re-renders the row when the sub-scene arrives.
  const subScene = useSubSceneChildren(node, externalResources);

  // Null for a non-GLB row. The hook re-renders the row when the GLB arrives.
  const glbChildren = useGlbChildren(node);

  // What lives below this node, and in what resource scope. A GLB row reuses
  // the list `useGlbChildren` already built, not a second walk. The memo keeps
  // the groups stable across selection and hover, so `effective` reuses one merge.
  const groups: readonly LiveChildGroup[] = useMemo(() => {
    // The tree renders rows and resolves instance refs. It never reads a
    // SubResource id, so it declares an empty pool explicitly.
    const scope = { externalResources, internalResources: [] };
    if (node.type === GLB_SCENE_ROOT_TYPE && glbChildren) {
      return [{ origin: 'glb' as const, children: glbChildren, scope }];
    }
    return liveChildGroups(node, scope, singleSceneCache(scenePath, subScene));
  }, [node, externalResources, scenePath, subScene, glbChildren]);

  // Instance root merge (ADR-0013), the same decision the viewport and inspector
  // make, for the row header. It reads the `merged` group, so the merge runs once
  // per row. Every other origin keeps the raw node, as `collapseLiveNode` does.
  const effective = useMemo(
    () => groups.find((g) => g.origin === 'merged')?.mergedNode ?? node,
    [groups, node]
  );

  const hasChildren = groups.some((g) => g.children.length > 0);

  // `keyPrefix` is the group's origin, so an inline child that shares a name with
  // a sub-scene root does not trip React's duplicate-key warning. `childRes` is
  // the scope the child resolves its own instance ref against.
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

  // A parser registration is no evidence of a render: only a type with no
  // component at all is a gap.
  const isUnsupported = rendersOwnVisual(effective.type) === 'not-implemented';

  // This row is the tab stop when it is selected or when it is the fallback row.
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
              .map((child) => renderChildRow(child, group.origin, group.scope.externalResources))
          )}
        </div>
      )}
    </div>
  );
}

export const TreeNode = memo(TreeNodeImpl);
