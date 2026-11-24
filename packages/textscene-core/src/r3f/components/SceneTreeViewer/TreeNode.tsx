/** One tree row and its recursive children, internal to `<SceneTreeViewer>`. */
import { memo, useMemo, type MouseEvent } from 'react';
import type { LiveChildGroup } from '../../liveSceneTree.js';
import type { SceneScope, TscnNode, TscnExternalResource } from '../../../parser/types.js';
import { joinPath } from '../../../utils/nodePath.js';
import { rendersOwnVisual } from '../../nodeSupport.js';
import { useExpandedRowActions, useIsExpandedRow } from '../TscnPreviewShell/expandedRows.js';
import { useHoverPath, useSelectPath, useSelectedPath } from '../TscnPreviewShell/previewSelection.js';
import { descendsFromClass } from '../../../godot/classdb/classBaseTypes.js';
import { spaceFamilyOf } from '../../../godot/scene/parentSpace.js';
import { isCanvasLayerType } from '../../canvasItemClass.js';
import { isShownCanvasNode } from '../../canvasScopes.js';
import { scopeOf, type LiveNode } from '../../../resources/liveNode.js';
import { useLiveStep } from './useLiveStep.js';
import { useWrittenChildVisibility } from '../../useLiveSceneTree.js';
import styles from './SceneTreeViewer.module.css';

/** One empty pool for every row, so a row that mounts again asks the live tree in a scope it knows. */
const NO_SUB_RESOURCES: SceneScope['internalResources'] = [];

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

function hasTransform(node: TscnNode): boolean {
  return 'transform' in node.properties && node.properties.transform !== undefined;
}

/** The classes that have the eye (scene_tree_editor.cpp:608). */
type VisibilityChain = 'Node3D' | 'CanvasItem' | 'CanvasLayer' | 'Window';

function visibilityChainOf(type: string): VisibilityChain | null {
  const family = spaceFamilyOf(type);
  if (family) return family;
  if (isCanvasLayerType(type)) return 'CanvasLayer';
  return descendsFromClass(type, 'Window') ? 'Window' : null;
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
  node: TscnNode;
  parentPath: string;
  depth: number;
  /** The parent row's visibility, which dims this row's eye (scene_tree_editor.cpp:743-748). */
  parentVisibility: ParentVisibility;
  /** The `visible` the parent container writes on this node, which its own gives way to. */
  containerVisible?: boolean;
  /** Writes `visible` to the node at `path`. */
  onToggleVisibility: (path: string, visible: boolean) => void;
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
  /** Whether Godot's Scene dock lists the node at this path (`dockListing.ts`). */
  isListedChild: (path: string) => boolean;
  /**
   * The host scene's externalResources, which resolve `ExtResource("id")` to
   * the PackedScene's `res://` path with no re-read of HierarchyContext.
   */
  externalResources: readonly TscnExternalResource[];
  /**
   * The scenes whose instances enclose this row, outermost first
   * (`SceneScope.instancedScenePaths`), so a cyclic instance shows no content. A
   * root row has none.
   */
  instancedScenePaths?: readonly string[];
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
  parentVisibility,
  containerVisible,
  onToggleVisibility,
  onNodeReveal,
  onOpenSubScene,
  matches,
  isListedChild,
  externalResources,
  instancedScenePaths,
  isDefaultFocusable = false,
}: TreeNodeProps) {
  const nodePath = joinPath(parentPath, node.name);
  // The tree renders rows and resolves instance refs. It never reads a SubResource id, so it
  // declares an empty pool explicitly. A grafted node's own scope replaces the group's.
  const scope = useMemo(
    () => scopeOf(node, { externalResources, internalResources: NO_SUB_RESOURCES, instancedScenePaths }),
    [node, externalResources, instancedScenePaths]
  );
  // The node as the tree shows it, and what lives below it. Instance root merge (ADR-0013), the
  // same decision the viewport and inspector make, for the row header. The hook keeps the step
  // stable across selection and hover, so the row reuses one merge.
  const step = useLiveStep(node, scope);
  const { node: effective, groups: liveGroups, instancePath } = step;
  const writtenVisibility = useWrittenChildVisibility(step);
  const groups = useMemo(
    () => listedGroups(liveGroups, (child) => isListedChild(joinPath(nodePath, child.name))),
    [liveGroups, isListedChild, nodePath]
  );
  const instanceScenePath = onOpenSubScene ? instancePath : null;

  const hasChildren = groups.some((g) => g.children.length > 0);

  // `keyPrefix` is the group's origin, so an inline child that shares a name with
  // a sub-scene root does not trip React's duplicate-key warning. `childScope` is
  // the scope the child resolves its own instance ref against.
  const renderChildRow = (child: TscnNode, keyPrefix: string, childScope: SceneScope) => (
    <TreeNode
      key={`${keyPrefix}:${child.name}`}
      node={child}
      parentPath={nodePath}
      depth={depth + 1}
      parentVisibility={ownVisibility}
      containerVisible={writtenVisibility.get(child)}
      onToggleVisibility={onToggleVisibility}
      onNodeReveal={onNodeReveal}
      onOpenSubScene={onOpenSubScene}
      matches={matches}
      isListedChild={isListedChild}
      externalResources={childScope.externalResources}
      instancedScenePaths={childScope.instancedScenePaths}
    />
  );

  const { toggle: toggleExpanded } = useExpandedRowActions();
  const selectPath = useSelectPath();
  const hoverPath = useHoverPath();

  const isExpanded = useIsExpandedRow(nodePath);
  const isSelected = useSelectedPath() === nodePath;
  // The eye shows the node's own `visible`, and only on a class that has it (scene_tree_editor.cpp:608-613).
  const chain = useMemo(() => visibilityChainOf(effective.type), [effective.type]);
  const hasEye = chain !== null;
  const isHidden = hasEye && !(containerVisible ?? isShownCanvasNode(effective));
  const isParentVisible = isParentVisibleOf(chain, parentVisibility);
  const isViewport = useMemo(() => descendsFromClass(effective.type, 'Viewport'), [effective.type]);
  const isViewportShown = isViewport ? !isHidden : parentVisibility.isViewportShown;
  const ownVisibility = useMemo<ParentVisibility>(
    () => ({ chain, isVisibleInTree: !isHidden && isParentVisible, isViewportShown }),
    [chain, isHidden, isParentVisible, isViewportShown]
  );

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
    toggleExpanded(nodePath);
  }

  function handleSelect() {
    selectPath(nodePath);
  }

  function handleDoubleClick() {
    onNodeReveal?.(nodePath, node);
  }

  function handleMouseEnter() {
    hoverPath(nodePath);
  }

  function handleMouseLeave() {
    hoverPath(null);
  }

  function handleToggleVisibility(e: MouseEvent) {
    e.stopPropagation();
    onToggleVisibility(nodePath, isHidden);
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

        <span className={`${styles.typeBadge} ${getTypeBadgeClass(effective.type)}`} title={effective.type}>
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
            <span className={styles.instanceIcon} title={`External scene: ${node.instance}`}>
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
          {groups.flatMap((group) =>
            group.children
              .filter((child) => matches(joinPath(nodePath, child.name)))
              .map((child) => renderChildRow(child, group.origin, group.scope))
          )}
        </div>
      )}
    </div>
  );
}

export const TreeNode = memo(TreeNodeImpl);

/** `groups` with the children the Scene dock lists, none without an owner (`tile_map_layer.cpp:1646`). */
function listedGroups(
  groups: readonly LiveChildGroup[],
  lists: (child: LiveNode) => boolean
): readonly LiveChildGroup[] {
  let isAnyHidden = false;
  const shown = groups.map((group) => {
    const children = group.children.filter((child) => !child.isUnowned && lists(child));
    isAnyHidden ||= children.length < group.children.length;
    return { ...group, children };
  });
  return isAnyHidden ? shown : groups;
}
