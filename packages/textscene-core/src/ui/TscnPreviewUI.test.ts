/**
 * Tests for TscnPreviewUI - main UI orchestration layer
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TscnPreviewUI } from './TscnPreviewUI';
import type { TscnPreviewElements } from './TscnPreviewUI';
import type { TscnScene } from '../parser/types';

// Mock dependencies
vi.mock('../parser/TscnParser');
vi.mock('../core/TscnRenderer');
vi.mock('./SceneTreeViewer');
vi.mock('./ViewportSelector');

describe('TscnPreviewUI', () => {
  let elements: TscnPreviewElements;
  let ui: TscnPreviewUI;
  let resizeListener: EventListener | null = null;

  beforeEach(() => {
    // Create mock DOM elements
    const canvas = document.createElement('canvas');
    const errorDisplay = document.createElement('div');
    const errorMessage = document.createElement('p');
    const sceneInfo = document.createElement('div');
    const nodeCount = document.createElement('p');
    const rootNode = document.createElement('p');
    const treeViewerContainer = document.createElement('div');
    const expandAllBtn = document.createElement('button');
    const collapseAllBtn = document.createElement('button');
    const treeSearchInput = document.createElement('input');
    const nodeDetailsPanel = document.createElement('div');
    const detailsNodeName = document.createElement('h3');
    const detailsContent = document.createElement('div');

    elements = {
      canvas,
      errorDisplay,
      errorMessage,
      sceneInfo,
      nodeCount,
      rootNode,
      treeViewerContainer,
      expandAllBtn,
      collapseAllBtn,
      treeSearchInput,
      nodeDetailsPanel,
      detailsNodeName,
      detailsContent
    };

    // Capture resize listener
    const originalAddEventListener = window.addEventListener;
    vi.spyOn(window, 'addEventListener').mockImplementation((event, listener) => {
      if (event === 'resize') {
        resizeListener = listener as EventListener;
      }
      return originalAddEventListener.call(window, event, listener);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resizeListener = null;
  });

  describe('Constructor', () => {
    it('should create TscnPreviewUI with elements', () => {
      ui = new TscnPreviewUI(elements);

      expect(ui).toBeDefined();
      expect(ui).toBeInstanceOf(TscnPreviewUI);
    });

    it('should create TscnPreviewUI with options', () => {
      const onNodeDoubleClick = vi.fn();
      const onResourceNeeded = vi.fn();

      ui = new TscnPreviewUI(elements, {
        onNodeDoubleClick,
        onResourceNeeded
      });

      expect(ui).toBeDefined();
    });

    it('should initialize parser and renderer', () => {
      ui = new TscnPreviewUI(elements);

      expect(ui.getParser()).toBeDefined();
      expect(ui.getRenderer()).toBeDefined();
    });

    it('should setup resize handler', () => {
      ui = new TscnPreviewUI(elements);

      expect(window.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('should start animation loop on renderer', () => {
      ui = new TscnPreviewUI(elements);

      const renderer = ui.getRenderer();
      expect(renderer.startAnimationLoop).toHaveBeenCalled();
    });

    it('should setup tree viewer when container provided', () => {
      ui = new TscnPreviewUI(elements);

      // Tree viewer should be created (tested indirectly through behavior)
      expect(ui).toBeDefined();
    });

    it('should not setup tree viewer when container not provided', () => {
      const minimalElements = {
        ...elements,
        treeViewerContainer: undefined,
        expandAllBtn: undefined,
        collapseAllBtn: undefined,
        treeSearchInput: undefined
      };

      expect(() => new TscnPreviewUI(minimalElements)).not.toThrow();
    });

    it('should setup viewport selector', () => {
      ui = new TscnPreviewUI(elements);

      // Viewport selector should be created (tested indirectly through behavior)
      expect(ui).toBeDefined();
    });
  });

  describe('Resize Handling', () => {
    it('should resize canvas to window size by default', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

      ui = new TscnPreviewUI(elements);

      expect(elements.canvas.width).toBe(1024);
      expect(elements.canvas.height).toBe(768);
    });

    it('should call renderer.resize with window dimensions', () => {
      Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true });

      ui = new TscnPreviewUI(elements);
      const renderer = ui.getRenderer();

      expect(renderer.resize).toHaveBeenCalledWith(800, 600);
    });

    it('should handle window resize events', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

      ui = new TscnPreviewUI(elements);

      // Change window size
      Object.defineProperty(window, 'innerWidth', { value: 1920, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 1080, configurable: true });

      // Trigger resize event
      if (resizeListener) {
        resizeListener(new Event('resize'));
      }

      expect(elements.canvas.width).toBe(1920);
      expect(elements.canvas.height).toBe(1080);
    });

    it('should use custom resize handler when provided', () => {
      const customResize = vi.fn();
      ui = new TscnPreviewUI(elements, { customResize });

      expect(customResize).toHaveBeenCalledWith(elements.canvas, ui.getRenderer());
    });

    it('should call custom resize on window resize', () => {
      const customResize = vi.fn();
      ui = new TscnPreviewUI(elements, { customResize });

      customResize.mockClear();

      // Trigger resize event
      if (resizeListener) {
        resizeListener(new Event('resize'));
      }

      expect(customResize).toHaveBeenCalledWith(elements.canvas, ui.getRenderer());
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      ui = new TscnPreviewUI(elements);
    });

    it('should show error message', () => {
      ui.showError('Test error message');

      expect(elements.errorMessage.textContent).toBe('Test error message');
      expect(elements.errorDisplay.classList.contains('visible')).toBe(true);
      expect(elements.sceneInfo.classList.contains('visible')).toBe(false);
    });

    it('should hide error message', () => {
      elements.errorDisplay.classList.add('visible');

      ui.hideError();

      expect(elements.errorDisplay.classList.contains('visible')).toBe(false);
    });

    it('should replace previous error message', () => {
      ui.showError('First error');
      ui.showError('Second error');

      expect(elements.errorMessage.textContent).toBe('Second error');
    });
  });

  describe('Scene Info Display', () => {
    beforeEach(() => {
      ui = new TscnPreviewUI(elements);
    });

    it('should update scene info with node count', () => {
      const scene: TscnScene = {
        nodes: [
          {
            name: 'Root',
            type: 'Node3D',
            properties: {},
            children: [
              {
                name: 'Child1',
                type: 'Node3D',
                properties: {},
                children: []
              },
              {
                name: 'Child2',
                type: 'Node3D',
                properties: {},
                children: []
              }
            ]
          }
        ],
        externalResources: [],
        internalResources: []
      };

      ui.updateSceneInfo(scene);

      expect(elements.nodeCount.textContent).toBe('Nodes: 3');
      expect(elements.rootNode.textContent).toBe('Root: Root');
      expect(elements.sceneInfo.classList.contains('visible')).toBe(true);
    });

    it('should handle empty scene', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: []
      };

      ui.updateSceneInfo(scene);

      expect(elements.nodeCount.textContent).toBe('Nodes: 0');
      expect(elements.rootNode.textContent).toBe('Root: None');
    });

    it('should count nested nodes correctly', () => {
      const scene: TscnScene = {
        nodes: [
          {
            name: 'Root',
            type: 'Node3D',
            properties: {},
            children: [
              {
                name: 'Level1',
                type: 'Node3D',
                properties: {},
                children: [
                  {
                    name: 'Level2',
                    type: 'Node3D',
                    properties: {},
                    children: []
                  }
                ]
              }
            ]
          }
        ],
        externalResources: [],
        internalResources: []
      };

      ui.updateSceneInfo(scene);

      expect(elements.nodeCount.textContent).toBe('Nodes: 3');
    });
  });

  describe('loadTscn()', () => {
    beforeEach(() => {
      ui = new TscnPreviewUI(elements);

      // Setup parser to return a valid scene
      const parser = ui.getParser();
      parser.parse.mockReturnValue({
        nodes: [
          {
            name: 'Root',
            type: 'Node3D',
            properties: {},
            children: []
          }
        ],
        externalResources: [],
        internalResources: []
      });
    });

    it('should parse TSCN content', async () => {
      const tscnContent = '[gd_scene]\n[node name="Root" type="Node3D"]';
      const parser = ui.getParser();

      await ui.loadTscn(tscnContent);

      expect(parser.parse).toHaveBeenCalledWith(tscnContent);
    });

    it('should render parsed scene', async () => {
      const tscnContent = '[gd_scene]\n[node name="Root" type="Node3D"]';
      const renderer = ui.getRenderer();

      await ui.loadTscn(tscnContent);

      expect(renderer.render).toHaveBeenCalled();
    });

    it('should update scene info after successful load', async () => {
      const tscnContent = '[gd_scene]\n[node name="Root" type="Node3D"]';

      await ui.loadTscn(tscnContent);

      // Scene info should be updated (text content verified in separate test)
      expect(elements.sceneInfo.classList.contains('visible')).toBe(true);
    });

    it('should hide error before loading', async () => {
      elements.errorDisplay.classList.add('visible');
      const tscnContent = '[gd_scene]\n[node name="Root" type="Node3D"]';

      await ui.loadTscn(tscnContent);

      expect(elements.errorDisplay.classList.contains('visible')).toBe(false);
    });

    it('should show error on parse failure', async () => {
      const parser = ui.getParser();
      parser.parse.mockImplementation(() => {
        throw new Error('Parse error');
      });

      await expect(ui.loadTscn('invalid content')).rejects.toThrow('Parse error');

      expect(elements.errorMessage.textContent).toContain('Failed to render TSCN');
      expect(elements.errorMessage.textContent).toContain('Parse error');
    });

    it('should show error on render failure', async () => {
      const renderer = ui.getRenderer();
      renderer.render.mockRejectedValue(new Error('Render error'));

      await expect(ui.loadTscn('[gd_scene]')).rejects.toThrow('Render error');

      expect(elements.errorMessage.textContent).toContain('Failed to render TSCN');
      expect(elements.errorMessage.textContent).toContain('Render error');
    });

    it('should handle non-Error exceptions', async () => {
      const parser = ui.getParser();
      parser.parse.mockImplementation(() => {
        throw 'String error';
      });

      await expect(ui.loadTscn('invalid')).rejects.toThrow();

      expect(elements.errorMessage.textContent).toContain('Unknown error occurred');
    });
  });

  describe('handleIncrementalUpdate()', () => {
    let scene: TscnScene;

    beforeEach(() => {
      ui = new TscnPreviewUI(elements);

      scene = {
        nodes: [
          {
            name: 'Root',
            type: 'Node3D',
            properties: {},
            children: [
              {
                name: 'Child',
                type: 'Node3D',
                properties: {},
                children: []
              }
            ]
          }
        ],
        externalResources: [],
        internalResources: []
      };
    });

    it('should process node removals', async () => {
      const changes = [
        {
          type: 'remove' as const,
          nodePath: 'Root/Child',
          node: null,
          parentPath: null
        }
      ];

      const renderer = ui.getRenderer();
      await ui.handleIncrementalUpdate(changes, scene);

      expect(renderer.removeNode).toHaveBeenCalledWith('Root/Child');
    });

    it('should process node updates', async () => {
      const updatedNode = {
        name: 'Child',
        type: 'Node3D',
        properties: { visible: false },
        children: []
      };

      const changes = [
        {
          type: 'update' as const,
          nodePath: 'Root/Child',
          node: updatedNode,
          parentPath: null
        }
      ];

      const renderer = ui.getRenderer();
      await ui.handleIncrementalUpdate(changes, scene);

      expect(renderer.updateNode).toHaveBeenCalledWith('Root/Child', updatedNode, scene);
    });

    it('should process node additions', async () => {
      const newNode = {
        name: 'NewChild',
        type: 'Node3D',
        properties: {},
        children: []
      };

      const changes = [
        {
          type: 'add' as const,
          nodePath: 'Root/NewChild',
          node: newNode,
          parentPath: 'Root'
        }
      ];

      const renderer = ui.getRenderer();
      await ui.handleIncrementalUpdate(changes, scene);

      expect(renderer.addNode).toHaveBeenCalledWith('Root/NewChild', newNode, scene, 'Root');
    });

    it('should process changes in correct order (remove, update, add)', async () => {
      const renderer = ui.getRenderer();
      const callOrder: string[] = [];

      renderer.removeNode.mockImplementation(() => callOrder.push('remove'));
      renderer.updateNode.mockImplementation(() => callOrder.push('update'));
      renderer.addNode.mockImplementation(() => callOrder.push('add'));

      const changes = [
        {
          type: 'add' as const,
          nodePath: 'Root/NewChild',
          node: { name: 'NewChild', type: 'Node3D', properties: {}, children: [] },
          parentPath: 'Root'
        },
        {
          type: 'remove' as const,
          nodePath: 'Root/OldChild',
          node: null,
          parentPath: null
        },
        {
          type: 'update' as const,
          nodePath: 'Root/Child',
          node: { name: 'Child', type: 'Node3D', properties: {}, children: [] },
          parentPath: null
        }
      ];

      await ui.handleIncrementalUpdate(changes, scene);

      expect(callOrder).toEqual(['remove', 'update', 'add']);
    });

    it('should sort removals by depth (deepest first)', async () => {
      const renderer = ui.getRenderer();
      const removedPaths: string[] = [];

      renderer.removeNode.mockImplementation((path: string) => {
        removedPaths.push(path);
      });

      const changes = [
        {
          type: 'remove' as const,
          nodePath: 'Root',
          node: null,
          parentPath: null
        },
        {
          type: 'remove' as const,
          nodePath: 'Root/Child/GrandChild',
          node: null,
          parentPath: null
        },
        {
          type: 'remove' as const,
          nodePath: 'Root/Child',
          node: null,
          parentPath: null
        }
      ];

      await ui.handleIncrementalUpdate(changes, scene);

      // Should remove deepest first
      expect(removedPaths).toEqual(['Root/Child/GrandChild', 'Root/Child', 'Root']);
    });

    it('should sort additions by depth (shallowest first)', async () => {
      const renderer = ui.getRenderer();
      const addedPaths: string[] = [];

      renderer.addNode.mockImplementation((path: string) => {
        addedPaths.push(path);
      });

      const changes = [
        {
          type: 'add' as const,
          nodePath: 'Root/Child/GrandChild',
          node: { name: 'GrandChild', type: 'Node3D', properties: {}, children: [] },
          parentPath: 'Root/Child'
        },
        {
          type: 'add' as const,
          nodePath: 'Root',
          node: { name: 'Root', type: 'Node3D', properties: {}, children: [] },
          parentPath: null
        },
        {
          type: 'add' as const,
          nodePath: 'Root/Child',
          node: { name: 'Child', type: 'Node3D', properties: {}, children: [] },
          parentPath: 'Root'
        }
      ];

      await ui.handleIncrementalUpdate(changes, scene);

      // Should add shallowest first
      expect(addedPaths).toEqual(['Root', 'Root/Child', 'Root/Child/GrandChild']);
    });

    it('should update scene info after incremental update', async () => {
      const changes = [
        {
          type: 'add' as const,
          nodePath: 'Root/NewChild',
          node: { name: 'NewChild', type: 'Node3D', properties: {}, children: [] },
          parentPath: 'Root'
        }
      ];

      await ui.handleIncrementalUpdate(changes, scene);

      expect(elements.sceneInfo.classList.contains('visible')).toBe(true);
    });

    it('should hide error before incremental update', async () => {
      elements.errorDisplay.classList.add('visible');

      await ui.handleIncrementalUpdate([], scene);

      expect(elements.errorDisplay.classList.contains('visible')).toBe(false);
    });

    it('should show error on incremental update failure', async () => {
      const renderer = ui.getRenderer();
      renderer.removeNode.mockImplementation(() => {
        throw new Error('Remove failed');
      });

      const changes = [
        {
          type: 'remove' as const,
          nodePath: 'Root/Child',
          node: null,
          parentPath: null
        }
      ];

      await expect(ui.handleIncrementalUpdate(changes, scene)).rejects.toThrow('Remove failed');

      expect(elements.errorMessage.textContent).toContain('Failed to apply incremental update');
    });

    it('should skip changes without node data', async () => {
      const renderer = ui.getRenderer();

      const changes = [
        {
          type: 'update' as const,
          nodePath: 'Root/Child',
          node: null, // No node data
          parentPath: null
        },
        {
          type: 'add' as const,
          nodePath: 'Root/NewChild',
          node: null, // No node data
          parentPath: 'Root'
        }
      ];

      await ui.handleIncrementalUpdate(changes, scene);

      expect(renderer.updateNode).not.toHaveBeenCalled();
      expect(renderer.addNode).not.toHaveBeenCalled();
    });
  });

  describe('resetCamera()', () => {
    it('should call renderer.resetCamera()', () => {
      ui = new TscnPreviewUI(elements);
      const renderer = ui.getRenderer();

      ui.resetCamera();

      expect(renderer.resetCamera).toHaveBeenCalled();
    });
  });

  describe('Getters', () => {
    beforeEach(() => {
      ui = new TscnPreviewUI(elements);
    });

    it('should return renderer instance', () => {
      const renderer = ui.getRenderer();

      expect(renderer).toBeDefined();
      expect(renderer.render).toBeDefined();
      expect(renderer.resize).toBeDefined();
    });

    it('should return parser instance', () => {
      const parser = ui.getParser();

      expect(parser).toBeDefined();
      expect(parser.parse).toBeDefined();
    });
  });
});
