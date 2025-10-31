/**
 * Handles viewport object selection via mouse interaction.
 */

import type { TscnScene, TscnNode } from '../parser/types';
import type { TscnRenderer } from '../core/TscnRenderer';
import { findNodeByPath } from '../utils/sceneGraphUtils';

export interface ViewportSelectorOptions {
  onNodeSelect?: (node: TscnNode, path: string) => void;
  onNodeHover?: (nodePath: string | null) => void;
}

export class ViewportSelector {
  private canvas: HTMLCanvasElement;
  private renderer: TscnRenderer;
  private options: ViewportSelectorOptions;
  private currentScene: TscnScene | null = null;
  private isDragging = false;
  private mouseDownPos = { x: 0, y: 0 };

  constructor(
    canvas: HTMLCanvasElement,
    renderer: TscnRenderer,
    options: ViewportSelectorOptions = {}
  ) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.options = options;
    this.setupEventListeners();
  }

  setScene(scene: TscnScene): void {
    this.currentScene = scene;
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('click', this.handleClick);
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
  }

  private handleMouseDown = (event: MouseEvent): void => {
    this.isDragging = false;
    this.mouseDownPos = { x: event.clientX, y: event.clientY };
  };

  private handleMouseMove = (event: MouseEvent): void => {
    if (this.mouseDownPos.x !== 0 || this.mouseDownPos.y !== 0) {
      const deltaX = event.clientX - this.mouseDownPos.x;
      const deltaY = event.clientY - this.mouseDownPos.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distance > 5) {
        this.isDragging = true;
      }
    }

    const nodePath = this.renderer.getNodePathAtScreenPosition(event.clientX, event.clientY);

    if (this.options.onNodeHover) {
      this.options.onNodeHover(nodePath);
    }
  };

  private handleClick = (event: MouseEvent): void => {
    if (this.isDragging) {
      this.isDragging = false;
      return;
    }

    const nodePath = this.renderer.getNodePathAtScreenPosition(event.clientX, event.clientY);
    if (nodePath && this.currentScene && this.options.onNodeSelect) {
      const node = findNodeByPath(this.currentScene.nodes, nodePath);
      if (node) {
        this.options.onNodeSelect(node, nodePath);
      }
    }
  };

  private handleMouseLeave = (): void => {
    if (this.options.onNodeHover) {
      this.options.onNodeHover(null);
    }
  };

  dispose(): void {
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('click', this.handleClick);
    this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
  }
}
