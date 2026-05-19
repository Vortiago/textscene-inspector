/**
 * Single tree row (header + recursive children container). Internal to
 * `<SceneTreeViewer>` — not exported from the package.
 */
import { memo, type MouseEvent } from 'react';
import type { TscnNode } from '../../../parser/types.js';
import { joinPath } from '../../../utils/nodePath.js';
import { nodeRegistry } from '../../../core/NodeRegistry.js';
import { useSelection } from '../../contexts/SelectionContext.js';
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
  matches: (node: TscnNode) => boolean;
}

function TreeNodeImpl({
  node,
  parentPath,
  depth,
  hiddenNodePaths,
  onToggleVisibility,
  onNodeReveal,
  matches,
}: TreeNodeProps) {
  const nodePath = joinPath(parentPath, node.name);
  const hasChildren = node.children.length > 0;

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

  const registration = nodeRegistry.getRegistration(node.type);
  const isUnsupported = !registration && node.type !== 'Node';

  const headerClasses = [styles.header];
  if (isSelected) headerClasses.push(styles.selected!);
  if (isHidden) headerClasses.push(styles.hidden!);
  if (isUnsupported) headerClasses.push(styles.unsupported!);
  if (node.instance && node.instanceMetadata?.isInstanceRoot) {
    headerClasses.push(styles.instanceRoot!);
  }

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

  const sourcePath = node.instanceMetadata?.sourcePath ?? node.instance;
  const isInstanceRoot = node.instanceMetadata?.isInstanceRoot === true;

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
          className={`${styles.typeBadge} ${getTypeBadgeClass(node.type)}`}
          title={node.type}
        >
          {getTypeShorthand(node.type)}
        </span>

        {isUnsupported && (
          <span
            className={styles.notImplementedBadge}
            title={`${node.type} is not yet supported by the renderer`}
          >
            Not Implemented
          </span>
        )}

        <span className={styles.nodeName}>{node.name}</span>

        {hasTransform(node) && (
          <span className={styles.transformIcon} title="Has transform">
            ⌖
          </span>
        )}

        {node.instance && sourcePath && (
          <span
            className={styles.instanceIcon}
            title={`External scene: ${sourcePath}${isInstanceRoot ? ' (instance root)' : ''}`}
          >
            📦
          </span>
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
      </div>

      {hasChildren && isExpanded && (
        <div className={styles.children} role="group">
          {node.children.filter(matches).map((child) => (
            <TreeNode
              key={child.name}
              node={child}
              parentPath={nodePath}
              depth={depth + 1}
              hiddenNodePaths={hiddenNodePaths}
              onToggleVisibility={onToggleVisibility}
              onNodeReveal={onNodeReveal}
              matches={matches}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export const TreeNode = memo(TreeNodeImpl);
