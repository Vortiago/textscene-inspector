/**
 * Single tree row (header + recursive children container). Internal to
 * `<SceneTreeViewer>` — not exported from the package.
 */
import { memo, type MouseEvent } from 'react';
import type { TscnNode, TscnExternalResource } from '../../../parser/types.js';
import { joinPath } from '../../../utils/nodePath.js';
import { nodeRegistry } from '../../../core/NodeRegistry.js';
import { useSelection } from '../../contexts/SelectionContext.js';
import { resolveInstancePath } from '../../../resources/SubResourceResolver.js';
import { mergeInstanceRoot } from '../../../resources/mergeInstanceRoot.js';
import { useSubSceneChildren } from './useSubSceneChildren.js';
import styles from './SceneTreeViewer.module.css';

const TYPE_BADGE_CLASS: Record<string, string> = {
  Node3D: styles.typeNode3d!,
  MeshInstance3D: styles.typeMesh!,
  Camera3D: styles.typeCamera!,
  Light3D: styles.typeLight!,
  SpotLight3D: styles.typeLight!,
  DirectionalLight3D: styles.typeLight!,
  OmniLight3D: styles.typeLight!,
};

const TYPE_SHORTHAND: Record<string, string> = {
  Node3D: 'N3D',
  MeshInstance3D: 'Mesh',
  Camera3D: 'Cam',
  Light3D: 'Light',
  SpotLight3D: 'Spot',
  DirectionalLight3D: 'Dir',
  OmniLight3D: 'Omni',
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
  matches: (node: TscnNode) => boolean;
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
  const instanceScenePath =
    node.instance && onOpenSubScene
      ? resolveInstancePath(node.instance, externalResources)
      : null;

  // WI-HALL-1: dynamically-loaded sub-scene children (when this node
  // has `instance = ExtResource("...")`). Returns null for non-instance
  // rows or while the sub-scene is still loading; treated as an empty
  // list for rendering. The `useResource` hook inside subscribes to the
  // scene event bus, so the tree re-renders automatically when the
  // sub-scene arrives.
  const subSceneChildren = useSubSceneChildren(node, externalResources);

  // Instance root merge (ADR-0013): a single non-GLB root collapses INTO this
  // row — it adopts the root's type and renders the root's children (plus any
  // host-added children) directly, dropping the redundant wrapper level. The
  // 📦 badge + ⤢ open-standalone affordance stay, driven by this node's own
  // `instance` ref below. `.glb` synthetic roots and multi-root scenes return
  // null here and keep the historical inline + sub-scene split.
  const merged =
    node.instance && subSceneChildren
      ? mergeInstanceRoot(node, { nodes: subSceneChildren })
      : null;

  // The row's type/properties/children come from the merged node when it
  // collapses; name, path, and instance affordance always come from `node`.
  const effective = merged ?? node;
  const inlineChildren = node.children;
  const dynamicChildren = subSceneChildren ?? [];
  const mergedChildren = merged ? merged.children : null;
  const hasChildren = mergedChildren
    ? mergedChildren.length > 0
    : inlineChildren.length > 0 || dynamicChildren.length > 0;

  const {
    selectedNodePath,
    expandedNodePaths,
    setSelectedNodePath,
    setHoveredNodePath,
    toggleExpandedNodePath,
  } = useSelection();

  const isExpanded = expandedNodePaths.has(nodePath);
  const isSelected = selectedNodePath === nodePath;
  const isHidden = hiddenNodePaths.has(nodePath);

  const registration = nodeRegistry.getRegistration(effective.type);
  const isUnsupported = !registration && effective.type !== 'Node';

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
    setHoveredNodePath(nodePath);
  }

  function handleMouseLeave() {
    setHoveredNodePath(null);
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
              // directly under this row — no synthetic wrapper segment.
              mergedChildren.filter(matches).map((child) => (
                <TreeNode
                  key={`merged:${child.name}`}
                  node={child}
                  parentPath={nodePath}
                  depth={depth + 1}
                  hiddenNodePaths={hiddenNodePaths}
                  onToggleVisibility={onToggleVisibility}
                  onNodeReveal={onNodeReveal}
                  onOpenSubScene={onOpenSubScene}
                  matches={matches}
                  externalResources={externalResources}
                />
              ))
            : [
                ...inlineChildren.filter(matches).map((child) => (
                  <TreeNode
                    key={`inline:${child.name}`}
                    node={child}
                    parentPath={nodePath}
                    depth={depth + 1}
                    hiddenNodePaths={hiddenNodePaths}
                    onToggleVisibility={onToggleVisibility}
                    onNodeReveal={onNodeReveal}
                    onOpenSubScene={onOpenSubScene}
                    matches={matches}
                    externalResources={externalResources}
                  />
                )),
                ...dynamicChildren.filter(matches).map((child) => (
                  <TreeNode
                    // Different key namespace from inline children so a name
                    // collision (an inline child sharing a name with a sub-scene
                    // root) doesn't trigger React's "two children with the same
                    // key" warning.
                    key={`subscene:${child.name}`}
                    node={child}
                    parentPath={nodePath}
                    depth={depth + 1}
                    hiddenNodePaths={hiddenNodePaths}
                    onToggleVisibility={onToggleVisibility}
                    onNodeReveal={onNodeReveal}
                    onOpenSubScene={onOpenSubScene}
                    matches={matches}
                    externalResources={externalResources}
                  />
                )),
              ]}
        </div>
      )}
    </div>
  );
}

export const TreeNode = memo(TreeNodeImpl);
