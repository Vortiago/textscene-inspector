import { memo, useMemo, type MouseEvent } from 'react';
import { useExpandedRowActions, useIsExpandedRow } from '../TscnPreviewShell/expandedRows.js';
import { useHoverPath, useSelectPath, useSelectedPath } from '../TscnPreviewShell/previewSelection.js';
import { useUndrawnNode } from '../TscnPreviewShell/previewViewStatus.js';
import type { TreeRow, VisibilityChain } from './treeRows.js';
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
  return (Object.hasOwn(TYPE_BADGE_CLASS, type) ? TYPE_BADGE_CLASS[type] : undefined) ?? styles.typeUnknown!;
}

function getTypeShorthand(type: string): string {
  return (Object.hasOwn(TYPE_SHORTHAND, type) ? TYPE_SHORTHAND[type] : undefined) ?? type.substring(0, 4);
}

/** What a row hands its children of `visible`. */
export interface ParentVisibility {
  chain: VisibilityChain | null;
  /** The row's own `visible` and that of every node it inherits from. */
  isVisibleInTree: boolean;
  /** Whether the nearest Viewport above is shown: false only for a hidden Window. */
  isViewportShown: boolean;
}

export const ROOT_VISIBILITY: ParentVisibility = {
  chain: null,
  isVisibleInTree: true,
  isViewportShown: true,
};

/** Whether the nodes a row inherits `visible` from are visible (node_3d.cpp:1132, canvas_item.cpp:309). */
function isParentVisibleOf(chain: VisibilityChain | null, parent: ParentVisibility): boolean {
  if (chain === 'Node3D') return parent.chain !== 'Node3D' || parent.isVisibleInTree;
  if (chain !== 'CanvasItem') return true;
  if (parent.chain === 'CanvasItem' || parent.chain === 'CanvasLayer') return parent.isVisibleInTree;
  return parent.isViewportShown;
}

interface TreeNodeProps {
  row: TreeRow;
  depth: number;
  /** The parent row's visibility, which dims this row's eye (scene_tree_editor.cpp:743-748). */
  parentVisibility: ParentVisibility;
  /** `visible` of each row with the eye, by live path. */
  visibility: ReadonlyMap<string, boolean>;
  onToggleVisibility: (row: TreeRow, visible: boolean) => void;
  onNodeReveal?: (path: string, name: string) => void;
  /** Opens an instanced sub-scene as its own previewed scene, like Godot's "Open in Editor". */
  onOpenSubScene?: (scenePath: string) => void;
  /** Whether the row at this live path survives the search, so a match keeps its ancestor rows. */
  matches: (path: string) => boolean;
  /** True only for the root row while no selected row renders. */
  isDefaultFocusable?: boolean;
}

function TreeNodeImpl({
  row,
  depth,
  parentVisibility,
  visibility,
  onToggleVisibility,
  onNodeReveal,
  onOpenSubScene,
  matches,
  isDefaultFocusable = false,
}: TreeNodeProps) {
  const { path, chain } = row;
  const { toggle: toggleExpanded } = useExpandedRowActions();
  const selectPath = useSelectPath();
  const hoverPath = useHoverPath();
  const isExpanded = useIsExpandedRow(path);
  const isSelected = useSelectedPath() === path;
  const isUnsupported = useUndrawnNode(path)?.hasNoComponent ?? false;

  const hasChildren = row.children.length > 0;
  // The eye shows the node's own `visible`, and only on a class that has it (scene_tree_editor.cpp:608-613).
  const hasEye = chain !== null;
  const isHidden = hasEye && visibility.get(path) === false;
  const isParentVisible = isParentVisibleOf(chain, parentVisibility);
  const isViewportShown = row.isViewport ? !isHidden : parentVisibility.isViewportShown;
  const ownVisibility = useMemo<ParentVisibility>(
    () => ({ chain, isVisibleInTree: !isHidden && isParentVisible, isViewportShown }),
    [chain, isHidden, isParentVisible, isViewportShown]
  );
  const instanceScenePath = onOpenSubScene && row.sceneFilePath ? row.sceneFilePath : null;

  // This row is the tab stop when it is selected or when it is the fallback row.
  const isRovingTabStop = isSelected || isDefaultFocusable;

  const headerClasses = [styles.header];
  if (isSelected) headerClasses.push(styles.selected!);
  if (isHidden) headerClasses.push(styles.hidden!);
  if (isUnsupported) headerClasses.push(styles.unsupported!);

  function handleExpand(e: MouseEvent) {
    e.stopPropagation();
    toggleExpanded(path);
  }

  function handleToggleVisibility(e: MouseEvent) {
    e.stopPropagation();
    onToggleVisibility(row, isHidden);
  }

  return (
    <div className={styles.node} data-node-path={path} data-depth={depth}>
      <div
        className={headerClasses.join(' ')}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => selectPath(path)}
        onDoubleClick={() => onNodeReveal?.(path, row.name)}
        onMouseEnter={() => hoverPath(path)}
        onMouseLeave={() => hoverPath(null)}
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

        <span className={`${styles.typeBadge} ${getTypeBadgeClass(row.type)}`} title={row.type}>
          {getTypeShorthand(row.type)}
        </span>

        {isUnsupported && (
          <span
            className={styles.notImplementedBadge}
            title={`${row.type} is not yet supported by the renderer`}
          >
            Not Implemented
          </span>
        )}

        <span className={styles.nodeName}>{row.name}</span>

        <span className={styles.glyphs}>
          {row.sceneFilePath && (
            <span className={styles.instanceIcon} title={`Instance: ${row.sceneFilePath}`}>
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

          {hasEye && (
            <button
              type="button"
              className={
                isParentVisible ? styles.visibilityIcon : `${styles.visibilityIcon} ${styles.underHidden}`
              }
              onClick={handleToggleVisibility}
              title={isHidden ? 'Click to show' : 'Click to hide'}
              aria-label={isHidden ? 'Show node' : 'Hide node'}
            >
              {isHidden ? '🙈' : '👁️'}
            </button>
          )}
        </span>
      </div>

      {hasChildren && isExpanded && (
        <div className={styles.children} role="group">
          {row.children.map(
            (child, index) =>
              matches(child.path) && (
                <TreeNode
                  key={rowKeyOf(row.children, index)}
                  row={child}
                  depth={depth + 1}
                  parentVisibility={ownVisibility}
                  visibility={visibility}
                  onToggleVisibility={onToggleVisibility}
                  onNodeReveal={onNodeReveal}
                  onOpenSubScene={onOpenSubScene}
                  matches={matches}
                />
              )
          )}
        </div>
      )}
    </div>
  );
}

export const TreeNode = memo(TreeNodeImpl);

/** The path and its count among earlier siblings: a host child and a glTF node can share one name. */
function rowKeyOf(siblings: readonly TreeRow[], index: number): string {
  const { path } = siblings[index]!.node;
  const earlier = siblings.slice(0, index).filter((sibling) => sibling.node.path === path).length;
  return `${earlier}:${path}`;
}
