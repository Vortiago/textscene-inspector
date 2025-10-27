/**
 * Scene Tree Hierarchy Viewer for debugging and visualization.
 */

import type { TscnNode } from '../parser/types';
import { findNodeByPath } from '../utils/sceneGraphUtils';

export interface SceneTreeViewerOptions {
  onNodeSelect?: (node: TscnNode, path: string) => void;
  onNodeDoubleClick?: (node: TscnNode, path: string) => void;
}

export class SceneTreeViewer {
  private container: HTMLElement;
  private options: SceneTreeViewerOptions;
  private expandedNodes: Set<string> = new Set();
  private selectedNodePath: string | null = null;
  private currentNodes: TscnNode[] = [];
  private searchTerm: string = '';

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

  /**
   * Create a tree node element with all children.
   */
  private createNodeElement(node: TscnNode, parentPath: string, depth: number): HTMLElement {
    const nodePath = parentPath ? `${parentPath}/${node.name}` : node.name;
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
      const expandIcon = document.createElement('span');
      expandIcon.className = `tree-expand-icon ${isExpanded ? 'expanded' : 'collapsed'}`;
      expandIcon.textContent = isExpanded ? '▼' : '▶';
      expandIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleNode(nodePath);
      });
      nodeHeader.appendChild(expandIcon);
    } else {
      const spacer = document.createElement('span');
      spacer.className = 'tree-expand-spacer';
      spacer.textContent = '•';
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
      const transformIcon = document.createElement('span');
      transformIcon.className = 'tree-transform-icon';
      transformIcon.textContent = '⌖';
      transformIcon.title = 'Has transform';
      nodeHeader.appendChild(transformIcon);
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
      const nodePath = parentPath ? `${parentPath}/${node.name}` : node.name;
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

    const nodePath = parentPath ? `${parentPath}/${node.name}` : node.name;

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
