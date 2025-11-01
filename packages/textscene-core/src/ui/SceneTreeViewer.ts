/**
 * Scene Tree Hierarchy Viewer for debugging and visualization.
 */

import type { TscnNode } from '../parser/types';
import { findNodeByPath } from '../utils/sceneGraphUtils';
import { joinPath, getAncestorPaths } from '../utils/nodePath';

export interface SceneTreeViewerOptions {
  onNodeSelect?: (node: TscnNode, path: string) => void;
  onNodeDoubleClick?: (node: TscnNode, path: string) => void;
  onNodeVisibilityChange?: (nodePath: string, visible: boolean) => void;
}

export class SceneTreeViewer {
  private container: HTMLElement;
  private options: SceneTreeViewerOptions;
  private expandedNodes: Set<string> = new Set();
  private selectedNodePath: string | null = null;
  private currentNodes: TscnNode[] = [];
  private searchTerm: string = '';
  private hiddenNodes: Set<string> = new Set();

  constructor(container: HTMLElement, options: SceneTreeViewerOptions = {}) {
    this.container = container;
    this.options = options;
  }

  /**
   * Render the scene tree hierarchy.
   */
  renderTree(nodes: TscnNode[]): void {
    this.currentNodes = nodes;
    this.container.innerHTML = '';

    if (nodes.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'tree-empty';
      emptyMsg.textContent = 'No nodes to display';
      this.container.appendChild(emptyMsg);
      return;
    }

    const treeRoot = document.createElement('div');
    treeRoot.className = 'tree-root';

    let visibleCount = 0;
    nodes.forEach(node => {
      if (this.shouldShowNode(node, '')) {
        const nodeElement = this.createNodeElement(node, '', 0);
        treeRoot.appendChild(nodeElement);
        visibleCount++;
      }
    });

    if (this.searchTerm && visibleCount === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'tree-empty';
      emptyMsg.textContent = `No nodes match "${this.searchTerm}"`;
      treeRoot.appendChild(emptyMsg);
    }

    this.container.appendChild(treeRoot);
  }

  private createIcon(config: {
    className: string;
    content: string;
    title?: string;
    onClick?: (e: Event) => void;
  }): HTMLSpanElement {
    const icon = document.createElement('span');
    icon.className = config.className;
    icon.textContent = config.content;

    if (config.title) {
      icon.title = config.title;
    }

    if (config.onClick) {
      icon.addEventListener('click', config.onClick);
    }

    return icon;
  }

  private isNodeVisible(nodePath: string): boolean {
    if (this.hiddenNodes.has(nodePath)) {
      return false;
    }

    // Check if any ancestor is hidden
    return !getAncestorPaths(nodePath).some(ancestor =>
      this.hiddenNodes.has(ancestor)
    );
  }

  private toggleNodeVisibility(nodePath: string): void {
    const isCurrentlyVisible = !this.hiddenNodes.has(nodePath);

    if (isCurrentlyVisible) {
      this.hiddenNodes.add(nodePath);
    } else {
      this.hiddenNodes.delete(nodePath);
    }

    if (this.options.onNodeVisibilityChange) {
      this.options.onNodeVisibilityChange(nodePath, !isCurrentlyVisible);
    }

    this.refreshDisplay();
  }

  private createVisibilityIcon(nodePath: string): HTMLSpanElement {
    const isVisible = this.isNodeVisible(nodePath);
    return this.createIcon({
      className: 'tree-visibility-icon',
      content: isVisible ? '👁️' : '🙈',
      title: isVisible ? 'Click to hide' : 'Click to show',
      onClick: (e) => {
        e.stopPropagation();
        this.toggleNodeVisibility(nodePath);
      },
    });
  }

  /**
   * Create a tree node element with all children.
   */
  private createNodeElement(node: TscnNode, parentPath: string, depth: number): HTMLElement {
    const nodePath = joinPath(parentPath, node.name);
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = this.expandedNodes.has(nodePath);
    const isSelected = this.selectedNodePath === nodePath;

    // Main node container
    const nodeContainer = document.createElement('div');
    nodeContainer.className = 'tree-node';
    nodeContainer.dataset.nodePath = nodePath;
    nodeContainer.dataset.depth = depth.toString();

    // Node header (clickable row)
    const nodeHeader = document.createElement('div');
    nodeHeader.className = `tree-node-header ${isSelected ? 'selected' : ''}`;
    nodeHeader.style.paddingLeft = `${depth * 16 + 8}px`;

    // Expand/collapse icon
    if (hasChildren) {
      const expandIcon = this.createIcon({
        className: `tree-expand-icon ${isExpanded ? 'expanded' : 'collapsed'}`,
        content: isExpanded ? '▼' : '▶',
        onClick: (e) => {
          e.stopPropagation();
          this.toggleNode(nodePath);
        },
      });
      nodeHeader.appendChild(expandIcon);
    } else {
      const spacer = this.createIcon({
        className: 'tree-expand-spacer',
        content: '•',
      });
      nodeHeader.appendChild(spacer);
    }

    // Node type badge
    const typeBadge = document.createElement('span');
    typeBadge.className = `tree-node-type ${this.getTypeClass(node.type)}`;
    typeBadge.textContent = this.getTypeShorthand(node.type);
    typeBadge.title = node.type;
    nodeHeader.appendChild(typeBadge);

    // Node name
    const nodeName = document.createElement('span');
    nodeName.className = 'tree-node-name';
    nodeName.textContent = node.name;
    nodeHeader.appendChild(nodeName);

    // Transform indicator
    if (this.hasTransform(node)) {
      const transformIcon = this.createIcon({
        className: 'tree-transform-icon',
        content: '⌖',
        title: 'Has transform',
      });
      nodeHeader.appendChild(transformIcon);
    }

    // External scene instance indicator
    if (node.instance) {
      // Use instanceMetadata for enhanced tooltip if available
      const sourcePath = node.instanceMetadata?.sourcePath || node.instance;
      const isInstanceRoot = node.instanceMetadata?.isInstanceRoot || false;

      const instanceIcon = this.createIcon({
        className: 'tree-instance-icon',
        content: '📦',
        title: `External scene: ${sourcePath}${isInstanceRoot ? ' (instance root)' : ''}`,
      });
      nodeHeader.appendChild(instanceIcon);

      // Add CSS class for instance root nodes
      if (isInstanceRoot) {
        nodeHeader.classList.add('instance-root');
      }
    }

    const visibilityIcon = this.createVisibilityIcon(nodePath);
    nodeHeader.appendChild(visibilityIcon);

    if (!this.isNodeVisible(nodePath)) {
      nodeHeader.classList.add('hidden');
    }

    // Click handlers
    nodeHeader.addEventListener('click', () => {
      this.selectNode(nodePath, node);
    });

    nodeHeader.addEventListener('dblclick', () => {
      if (this.options.onNodeDoubleClick) {
        this.options.onNodeDoubleClick(node, nodePath);
      }
    });

    nodeContainer.appendChild(nodeHeader);

    // Children container
    if (hasChildren && isExpanded) {
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'tree-node-children';

      node.children.forEach(child => {
        if (this.shouldShowNode(child, nodePath)) {
          const childElement = this.createNodeElement(child, nodePath, depth + 1);
          childrenContainer.appendChild(childElement);
        }
      });

      nodeContainer.appendChild(childrenContainer);
    }

    return nodeContainer;
  }

  /**
   * Toggle expand/collapse state of a node.
   */
  private toggleNode(nodePath: string): void {
    if (this.expandedNodes.has(nodePath)) {
      this.expandedNodes.delete(nodePath);
    } else {
      this.expandedNodes.add(nodePath);
    }

    // Re-render to update UI
    this.refreshDisplay();
  }

  /**
   * Select a node and trigger callback.
   */
  selectNode(nodePath: string, node?: TscnNode): void {
    this.selectedNodePath = nodePath;

    // Auto-expand ancestors to make the selected node visible
    const ancestors = getAncestorPaths(nodePath);
    ancestors.forEach(ancestorPath => {
      this.expandedNodes.add(ancestorPath);
    });

    // If node not provided, try to find it by path
    if (!node && this.options.onNodeSelect) {
      const foundNode = findNodeByPath(this.currentNodes, nodePath);
      if (foundNode) {
        node = foundNode;
      }
    }

    if (this.options.onNodeSelect && node) {
      this.options.onNodeSelect(node, nodePath);
    }

    this.refreshDisplay();
  }

  /**
   * Expand all nodes in the tree.
   */
  expandAll(): void {
    this.expandedNodes.clear();
    this.addAllNodePaths(this.getAllNodes());
    this.refreshDisplay();
  }

  /**
   * Collapse all nodes in the tree.
   */
  collapseAll(): void {
    this.expandedNodes.clear();
    this.refreshDisplay();
  }

  /**
   * Get all nodes recursively.
   */
  private getAllNodes(): TscnNode[] {
    const nodes: TscnNode[] = [];
    const traverse = (node: TscnNode) => {
      nodes.push(node);
      if (node.children) {
        node.children.forEach(traverse);
      }
    };

    this.currentNodes.forEach(traverse);
    return nodes;
  }

  /**
   * Add all node paths to expanded set.
   */
  private addAllNodePaths(nodes: TscnNode[], parentPath = ''): void {
    nodes.forEach(node => {
      const nodePath = joinPath(parentPath, node.name);
      if (node.children && node.children.length > 0) {
        this.expandedNodes.add(nodePath);
        this.addAllNodePaths(node.children, nodePath);
      }
    });
  }

  /**
   * Refresh the tree display (re-render).
   */
  private refreshDisplay(): void {
    this.renderTree(this.currentNodes);
  }

  /**
   * Check if node has transform data.
   */
  private hasTransform(node: TscnNode): boolean {
    return 'transform' in node.properties && node.properties.transform !== undefined;
  }

  /**
   * Get CSS class for node type.
   */
  private getTypeClass(type: string): string {
    const typeMap: Record<string, string> = {
      'Node3D': 'type-node3d',
      'MeshInstance3D': 'type-mesh',
      'Camera3D': 'type-camera',
      'Light3D': 'type-light',
      'SpotLight3D': 'type-light',
      'DirectionalLight3D': 'type-light',
      'OmniLight3D': 'type-light',
    };
    return typeMap[type] || 'type-unknown';
  }

  /**
   * Get short type label for badge.
   */
  private getTypeShorthand(type: string): string {
    const shorthandMap: Record<string, string> = {
      'Node3D': 'N3D',
      'MeshInstance3D': 'Mesh',
      'Camera3D': 'Cam',
      'Light3D': 'Light',
      'SpotLight3D': 'Spot',
      'DirectionalLight3D': 'Dir',
      'OmniLight3D': 'Omni',
    };
    return shorthandMap[type] || type.substring(0, 4);
  }

  /**
   * Clear the current selection.
   */
  clearSelection(): void {
    this.selectedNodePath = null;
    this.refreshDisplay();
  }

  /**
   * Get the currently selected node path.
   */
  getSelectedNodePath(): string | null {
    return this.selectedNodePath;
  }

  /**
   * Set search term and filter tree.
   */
  setSearchTerm(term: string): void {
    this.searchTerm = term.toLowerCase();
    this.refreshDisplay();
  }

  /**
   * Check if node or its descendants match search term.
   */
  private nodeMatchesSearch(node: TscnNode): boolean {
    if (!this.searchTerm) return true;

    // Check if node name matches
    if (node.name.toLowerCase().includes(this.searchTerm)) {
      return true;
    }

    // Check if node type matches
    if (node.type.toLowerCase().includes(this.searchTerm)) {
      return true;
    }

    // Check if any children match
    if (node.children && node.children.length > 0) {
      return node.children.some(child => this.nodeMatchesSearch(child));
    }

    return false;
  }

  /**
   * Check if node should be visible based on search.
   */
  private shouldShowNode(node: TscnNode, parentPath: string): boolean {
    if (!this.searchTerm) return true;

    const nodePath = joinPath(parentPath, node.name);

    // If node matches, show it
    if (this.nodeMatchesSearch(node)) {
      // Auto-expand nodes with matching descendants
      if (node.children && node.children.length > 0) {
        const hasMatchingChild = node.children.some(child => this.nodeMatchesSearch(child));
        if (hasMatchingChild) {
          this.expandedNodes.add(nodePath);
        }
      }
      return true;
    }

    return false;
  }
}
