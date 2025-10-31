/**
 * Manages UI state for TSCN preview applications.
 */

import type { TscnScene, TscnNode, ResourceNeededCallback } from '../parser/types';
import type { ResourceProvider } from '../resources/ResourceProvider';
import { TscnParser } from '../parser/TscnParser';
import { TscnRenderer } from '../core/TscnRenderer';
import { SceneTreeViewer } from './SceneTreeViewer';
import { ViewportSelector } from './ViewportSelector';
import { formatNodeDetails } from './NodeDetailsFormatter';
import { error } from '../logger';

export interface TscnPreviewElements {
  canvas: HTMLCanvasElement;
  errorDisplay: HTMLDivElement;
  errorMessage: HTMLParagraphElement;
  sceneInfo: HTMLDivElement;
  nodeCount: HTMLParagraphElement;
  rootNode: HTMLParagraphElement;
  treeViewerContainer?: HTMLDivElement;
  expandAllBtn?: HTMLButtonElement;
  collapseAllBtn?: HTMLButtonElement;
  treeSearchInput?: HTMLInputElement;
  nodeDetailsPanel?: HTMLDivElement;
  detailsNodeName?: HTMLHeadingElement;
  detailsContent?: HTMLDivElement;
}

export interface TscnPreviewUIOptions {
  customResize?: (canvas: HTMLCanvasElement, renderer: TscnRenderer) => void;
  onNodeDoubleClick?: (node: TscnNode, path: string) => void;
  onResourceNeeded?: ResourceNeededCallback;
  resourceProvider?: ResourceProvider;
}

export class TscnPreviewUI {
  private elements: TscnPreviewElements;
  private parser: TscnParser;
  private renderer: TscnRenderer;
  private options: TscnPreviewUIOptions;
  private treeViewer: SceneTreeViewer | null = null;
  private viewportSelector: ViewportSelector | null = null;
  private currentScene: TscnScene | null = null;

  constructor(elements: TscnPreviewElements, options: TscnPreviewUIOptions = {}) {
    this.elements = elements;
    this.options = options;
    this.parser = new TscnParser();
    this.renderer = new TscnRenderer(elements.canvas, {
      onResourceNeeded: options.onResourceNeeded,
    });

    this.setupResizeHandler();
    this.setupTreeViewer();
    this.setupViewportSelection();
    this.renderer.startAnimationLoop();
  }

  private setupTreeViewer(): void {
    if (!this.elements.treeViewerContainer) {
      return;
    }

    this.treeViewer = new SceneTreeViewer(this.elements.treeViewerContainer, {
      onNodeSelect: (node, path) => {
        this.showNodeDetails(node, path);
        this.renderer.highlightNode(path);
      },
      onNodeDoubleClick: this.options.onNodeDoubleClick,
      onNodeVisibilityChange: (nodePath, visible) => {
        this.renderer.setNodeVisibility(nodePath, visible);
      },
    });

    // Setup expand/collapse buttons
    if (this.elements.expandAllBtn) {
      this.elements.expandAllBtn.addEventListener('click', () => {
        this.treeViewer?.expandAll();
      });
    }

    if (this.elements.collapseAllBtn) {
      this.elements.collapseAllBtn.addEventListener('click', () => {
        this.treeViewer?.collapseAll();
      });
    }

    // Setup search input
    if (this.elements.treeSearchInput) {
      this.elements.treeSearchInput.addEventListener('input', (e) => {
        const searchTerm = (e.target as HTMLInputElement).value;
        this.treeViewer?.setSearchTerm(searchTerm);
      });
    }
  }

  private setupViewportSelection(): void {
    this.viewportSelector = new ViewportSelector(this.elements.canvas, this.renderer, {
      onNodeSelect: (node, path) => {
        this.treeViewer?.selectNode(path, node);
        this.renderer.highlightNode(path);
        this.showNodeDetails(node, path);
      },
      onNodeHover: (nodePath) => {
        if (nodePath) {
          this.renderer.showHoverEffect(nodePath);
        } else {
          this.renderer.clearHoverEffect();
        }
      },
    });
  }

  private showNodeDetails(node: TscnNode, path: string): void {
    if (!this.elements.nodeDetailsPanel || !this.elements.detailsNodeName || !this.elements.detailsContent) {
      return;
    }

    this.elements.nodeDetailsPanel.classList.add('visible');
    this.elements.detailsNodeName.textContent = node.name;
    this.elements.detailsContent.innerHTML = formatNodeDetails(node, path);
  }

  private setupResizeHandler(): void {
    const resizeCanvas = () => {
      if (this.options.customResize) {
        this.options.customResize(this.elements.canvas, this.renderer);
      } else {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.elements.canvas.width = width;
        this.elements.canvas.height = height;
        this.renderer.resize(width, height);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  showError(message: string): void {
    this.elements.errorMessage.textContent = message;
    this.elements.errorDisplay.classList.add('visible');
    this.elements.sceneInfo.classList.remove('visible');
  }

  hideError(): void {
    this.elements.errorDisplay.classList.remove('visible');
  }

  updateSceneInfo(scene: TscnScene): void {
    const totalNodes = this.countNodes(scene.nodes);
    const rootNodeName = scene.nodes.length > 0 ? scene.nodes[0]!.name : 'None';

    this.elements.nodeCount.textContent = `Nodes: ${totalNodes}`;
    this.elements.rootNode.textContent = `Root: ${rootNodeName}`;
    this.elements.sceneInfo.classList.add('visible');
  }

  private countNodes(nodes: TscnScene['nodes']): number {
    let count = nodes.length;
    for (const node of nodes) {
      count += this.countNodes(node.children);
    }
    return count;
  }

  async loadTscn(content: string): Promise<void> {
    try {
      this.hideError();

      const scene = this.parser.parse(content);
      this.currentScene = scene;

      // Set resource provider if available
      if (this.options.resourceProvider && scene.resourceRegistry) {
        scene.resourceRegistry.setProvider(this.options.resourceProvider);
      }

      await this.renderer.render(scene);
      this.updateSceneInfo(scene);

      if (this.treeViewer) {
        this.treeViewer.renderTree(scene.nodes);
      }

      if (this.viewportSelector) {
        this.viewportSelector.setScene(scene);
      }
    } catch (err) {
      error('Error rendering TSCN:', err);
      const errorMsg =
        err instanceof Error ? err.message : 'Unknown error occurred';
      this.showError(`Failed to render TSCN: ${errorMsg}`);
      throw err;
    }
  }

  resetCamera(): void {
    this.renderer.resetCamera();
  }

  getRenderer(): TscnRenderer {
    return this.renderer;
  }

  getParser(): TscnParser {
    return this.parser;
  }

  async handleIncrementalUpdate(changes: import('../types/changes').NodeChange[], sceneData: TscnScene): Promise<void> {
    try {
      this.hideError();
      this.currentScene = sceneData;

      // Sort changes to process in optimal order:
      // 1. Removals first (deepest nodes first to avoid orphans)
      // 2. Updates second
      // 3. Adds last (top-down for proper parenting)
      const removals = changes.filter(c => c.type === 'remove')
        .sort((a, b) => b.nodePath.split('/').length - a.nodePath.split('/').length);
      const updates = changes.filter(c => c.type === 'update');
      const adds = changes.filter(c => c.type === 'add')
        .sort((a, b) => a.nodePath.split('/').length - b.nodePath.split('/').length);

      // Process removals
      for (const change of removals) {
        this.renderer.removeNode(change.nodePath);
      }

      // Process updates
      for (const change of updates) {
        if (change.node) {
          await this.renderer.updateNode(change.nodePath, change.node, sceneData);
        }
      }

      // Process adds
      for (const change of adds) {
        if (change.node) {
          await this.renderer.addNode(change.nodePath, change.node, sceneData, change.parentPath);
        }
      }

      // Update tree viewer with new scene data
      if (this.treeViewer) {
        this.treeViewer.renderTree(sceneData.nodes);
      }

      // Update viewport selector with new scene data
      if (this.viewportSelector) {
        this.viewportSelector.setScene(sceneData);
      }

      // Update scene info
      this.updateSceneInfo(sceneData);
    } catch (err) {
      error('Error applying incremental update:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      this.showError(`Failed to apply incremental update: ${errorMsg}`);
      throw err;
    }
  }
}
