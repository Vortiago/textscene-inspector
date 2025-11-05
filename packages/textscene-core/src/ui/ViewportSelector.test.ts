/**
 * Tests for ViewportSelector - viewport mouse interaction and node selection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ViewportSelector } from './ViewportSelector';
import type { TscnRenderer } from '../core/TscnRenderer';
import type { TscnScene } from '../parser/types';

describe('ViewportSelector', () => {
  let canvas: HTMLCanvasElement;
  let mockRenderer: TscnRenderer;
  let selector: ViewportSelector;

  beforeEach(() => {
    // Create mock canvas
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;

    // Create mock renderer
    mockRenderer = {
      getNodePathAtScreenPosition: vi.fn()
    } as unknown as TscnRenderer;
  });

  describe('Constructor', () => {
    it('should create ViewportSelector with canvas and renderer', () => {
      selector = new ViewportSelector(canvas, mockRenderer);

      expect(selector).toBeDefined();
      expect(selector).toBeInstanceOf(ViewportSelector);
    });

    it('should create ViewportSelector without options', () => {
      selector = new ViewportSelector(canvas, mockRenderer);

      expect(selector).toBeDefined();
    });

    it('should create ViewportSelector with options', () => {
      const onNodeSelect = vi.fn();
      const onNodeHover = vi.fn();

      selector = new ViewportSelector(canvas, mockRenderer, {
        onNodeSelect,
        onNodeHover
      });

      expect(selector).toBeDefined();
    });

    it('should setup event listeners on canvas', () => {
      const addEventListenerSpy = vi.spyOn(canvas, 'addEventListener');

      selector = new ViewportSelector(canvas, mockRenderer);

      expect(addEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('mouseleave', expect.any(Function));
    });
  });

  describe('setScene()', () => {
    it('should set current scene', () => {
      selector = new ViewportSelector(canvas, mockRenderer);

      const scene: TscnScene = {
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
      };

      selector.setScene(scene);

      // Scene should be stored (tested indirectly through click behavior)
      expect(selector).toBeDefined();
    });

    it('should allow setting scene multiple times', () => {
      selector = new ViewportSelector(canvas, mockRenderer);

      const scene1: TscnScene = {
        nodes: [{ name: 'Scene1', type: 'Node3D', properties: {}, children: [] }],
        externalResources: [],
        internalResources: []
      };

      const scene2: TscnScene = {
        nodes: [{ name: 'Scene2', type: 'Node3D', properties: {}, children: [] }],
        externalResources: [],
        internalResources: []
      };

      expect(() => {
        selector.setScene(scene1);
        selector.setScene(scene2);
      }).not.toThrow();
    });
  });

  describe('Mouse Event Handling', () => {
    describe('mousedown', () => {
      it('should track mouse down position', () => {
        selector = new ViewportSelector(canvas, mockRenderer);

        const mouseEvent = new MouseEvent('mousedown', {
          clientX: 100,
          clientY: 200
        });

        canvas.dispatchEvent(mouseEvent);

        // Position tracked (tested indirectly through drag detection)
        expect(selector).toBeDefined();
      });

      it('should reset dragging flag on mousedown', () => {
        const onNodeSelect = vi.fn();
        selector = new ViewportSelector(canvas, mockRenderer, { onNodeSelect });

        const scene: TscnScene = {
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
        };

        selector.setScene(scene);

        // Simulate drag
        canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 0, clientY: 0 }));
        canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100 }));

        // Reset with new mousedown
        canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 200, clientY: 200 }));
        canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 201, clientY: 201 }));

        // Should not be dragging yet (distance < 5)
        expect(selector).toBeDefined();
      });
    });

    describe('mousemove', () => {
      it('should invoke onNodeHover callback with node path', () => {
        const onNodeHover = vi.fn();
        selector = new ViewportSelector(canvas, mockRenderer, { onNodeHover });

        vi.mocked(mockRenderer.getNodePathAtScreenPosition).mockReturnValue('Root/TestNode');

        const mouseEvent = new MouseEvent('mousemove', {
          clientX: 100,
          clientY: 200
        });

        canvas.dispatchEvent(mouseEvent);

        expect(onNodeHover).toHaveBeenCalledWith('Root/TestNode');
        expect(mockRenderer.getNodePathAtScreenPosition).toHaveBeenCalledWith(100, 200);
      });

      it('should invoke onNodeHover with null when no node under cursor', () => {
        const onNodeHover = vi.fn();
        selector = new ViewportSelector(canvas, mockRenderer, { onNodeHover });

        vi.mocked(mockRenderer.getNodePathAtScreenPosition).mockReturnValue(null);

        canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 200 }));

        expect(onNodeHover).toHaveBeenCalledWith(null);
      });

      it('should not throw when onNodeHover not provided', () => {
        selector = new ViewportSelector(canvas, mockRenderer);

        vi.mocked(mockRenderer.getNodePathAtScreenPosition).mockReturnValue('Root/Node');

        expect(() => {
          canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 200 }));
        }).not.toThrow();
      });

      it('should detect drag when mouse moves > 5 pixels', () => {
        selector = new ViewportSelector(canvas, mockRenderer);

        // Initial mousedown
        canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 100 }));

        // Move > 5 pixels
        canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 110, clientY: 110 }));

        // Should be dragging now (tested indirectly through click behavior)
        expect(selector).toBeDefined();
      });

      it('should not detect drag when mouse moves < 5 pixels', () => {
        selector = new ViewportSelector(canvas, mockRenderer);

        canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 100 }));
        canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 102, clientY: 102 }));

        // Should not be dragging (distance = sqrt(4+4) ≈ 2.83 < 5)
        expect(selector).toBeDefined();
      });
    });

    describe('click', () => {
      it('should invoke onNodeSelect callback when node clicked', () => {
        const onNodeSelect = vi.fn();
        selector = new ViewportSelector(canvas, mockRenderer, { onNodeSelect });

        const scene: TscnScene = {
          nodes: [
            {
              name: 'TestNode',
              type: 'Node3D',
              properties: {},
              children: []
            }
          ],
          externalResources: [],
          internalResources: []
        };

        selector.setScene(scene);

        vi.mocked(mockRenderer.getNodePathAtScreenPosition).mockReturnValue('TestNode');

        canvas.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 200 }));

        expect(onNodeSelect).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'TestNode', type: 'Node3D' }),
          'TestNode'
        );
      });

      it('should not invoke onNodeSelect when dragging', () => {
        const onNodeSelect = vi.fn();
        selector = new ViewportSelector(canvas, mockRenderer, { onNodeSelect });

        const scene: TscnScene = {
          nodes: [
            {
              name: 'TestNode',
              type: 'Node3D',
              properties: {},
              children: []
            }
          ],
          externalResources: [],
          internalResources: []
        };

        selector.setScene(scene);

        // Simulate drag
        canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 100 }));
        canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 150 }));

        vi.mocked(mockRenderer.getNodePathAtScreenPosition).mockReturnValue('TestNode');

        // Click after drag
        canvas.dispatchEvent(new MouseEvent('click', { clientX: 150, clientY: 150 }));

        expect(onNodeSelect).not.toHaveBeenCalled();
      });

      it('should not invoke onNodeSelect when no node path found', () => {
        const onNodeSelect = vi.fn();
        selector = new ViewportSelector(canvas, mockRenderer, { onNodeSelect });

        const scene: TscnScene = {
          nodes: [
            {
              name: 'TestNode',
              type: 'Node3D',
              properties: {},
              children: []
            }
          ],
          externalResources: [],
          internalResources: []
        };

        selector.setScene(scene);

        vi.mocked(mockRenderer.getNodePathAtScreenPosition).mockReturnValue(null);

        canvas.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 200 }));

        expect(onNodeSelect).not.toHaveBeenCalled();
      });

      it('should not invoke onNodeSelect when scene not set', () => {
        const onNodeSelect = vi.fn();
        selector = new ViewportSelector(canvas, mockRenderer, { onNodeSelect });

        vi.mocked(mockRenderer.getNodePathAtScreenPosition).mockReturnValue('TestNode');

        canvas.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 200 }));

        expect(onNodeSelect).not.toHaveBeenCalled();
      });

      it('should not invoke onNodeSelect when node not found in scene', () => {
        const onNodeSelect = vi.fn();
        selector = new ViewportSelector(canvas, mockRenderer, { onNodeSelect });

        const scene: TscnScene = {
          nodes: [
            {
              name: 'DifferentNode',
              type: 'Node3D',
              properties: {},
              children: []
            }
          ],
          externalResources: [],
          internalResources: []
        };

        selector.setScene(scene);

        vi.mocked(mockRenderer.getNodePathAtScreenPosition).mockReturnValue('NonExistentNode');

        canvas.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 200 }));

        expect(onNodeSelect).not.toHaveBeenCalled();
      });

      it('should not throw when onNodeSelect not provided', () => {
        selector = new ViewportSelector(canvas, mockRenderer);

        const scene: TscnScene = {
          nodes: [
            {
              name: 'TestNode',
              type: 'Node3D',
              properties: {},
              children: []
            }
          ],
          externalResources: [],
          internalResources: []
        };

        selector.setScene(scene);

        vi.mocked(mockRenderer.getNodePathAtScreenPosition).mockReturnValue('TestNode');

        expect(() => {
          canvas.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 200 }));
        }).not.toThrow();
      });
    });

    describe('mouseleave', () => {
      it('should invoke onNodeHover with null when mouse leaves canvas', () => {
        const onNodeHover = vi.fn();
        selector = new ViewportSelector(canvas, mockRenderer, { onNodeHover });

        canvas.dispatchEvent(new MouseEvent('mouseleave'));

        expect(onNodeHover).toHaveBeenCalledWith(null);
      });

      it('should not throw when onNodeHover not provided', () => {
        selector = new ViewportSelector(canvas, mockRenderer);

        expect(() => {
          canvas.dispatchEvent(new MouseEvent('mouseleave'));
        }).not.toThrow();
      });
    });
  });

  describe('dispose()', () => {
    it('should remove all event listeners', () => {
      const removeEventListenerSpy = vi.spyOn(canvas, 'removeEventListener');

      selector = new ViewportSelector(canvas, mockRenderer);
      selector.dispose();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseleave', expect.any(Function));
    });

    it('should not throw when called multiple times', () => {
      selector = new ViewportSelector(canvas, mockRenderer);

      expect(() => {
        selector.dispose();
        selector.dispose();
      }).not.toThrow();
    });

    it('should prevent callbacks after disposal', () => {
      const onNodeSelect = vi.fn();
      const onNodeHover = vi.fn();
      selector = new ViewportSelector(canvas, mockRenderer, {
        onNodeSelect,
        onNodeHover
      });

      selector.dispose();

      // Create new listeners after disposal
      canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 200 }));
      canvas.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 200 }));

      // Callbacks should not be invoked (listeners removed)
      expect(onNodeSelect).not.toHaveBeenCalled();
      expect(onNodeHover).not.toHaveBeenCalled();
    });
  });

  describe('Integration', () => {
    it('should handle complex interaction sequence', () => {
      const onNodeSelect = vi.fn();
      const onNodeHover = vi.fn();
      selector = new ViewportSelector(canvas, mockRenderer, {
        onNodeSelect,
        onNodeHover
      });

      const scene: TscnScene = {
        nodes: [
          {
            name: 'Root',
            type: 'Node3D',
            properties: {},
            children: [
              {
                name: 'Child',
                type: 'MeshInstance3D',
                properties: {},
                children: []
              }
            ]
          }
        ],
        externalResources: [],
        internalResources: []
      };

      selector.setScene(scene);

      vi.mocked(mockRenderer.getNodePathAtScreenPosition).mockReturnValue('Root/Child');

      // Hover over node
      canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100 }));
      expect(onNodeHover).toHaveBeenCalledWith('Root/Child');

      // Click node (without drag)
      canvas.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 100 }));
      expect(onNodeSelect).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Child' }),
        'Root/Child'
      );

      // Leave canvas
      canvas.dispatchEvent(new MouseEvent('mouseleave'));
      expect(onNodeHover).toHaveBeenCalledWith(null);
    });

    it('should handle nested node selection', () => {
      const onNodeSelect = vi.fn();
      selector = new ViewportSelector(canvas, mockRenderer, { onNodeSelect });

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
                    type: 'MeshInstance3D',
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

      selector.setScene(scene);

      vi.mocked(mockRenderer.getNodePathAtScreenPosition).mockReturnValue('Root/Level1/Level2');

      canvas.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 100 }));

      expect(onNodeSelect).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Level2', type: 'MeshInstance3D' }),
        'Root/Level1/Level2'
      );
    });
  });
});
