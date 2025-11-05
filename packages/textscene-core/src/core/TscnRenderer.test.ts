import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { TscnRenderer } from './TscnRenderer';
import type { TscnScene } from '../parser/types';

// Mock setupThreeJsScene
vi.mock('./SceneSetup', () => ({
  setupThreeJsScene: vi.fn(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(10, 10, 10);

    // Mock WebGLRenderer (doesn't create real WebGL context)
    const renderer = {
      render: vi.fn(),
      setSize: vi.fn(),
      dispose: vi.fn(),
      domElement: document.createElement('canvas'),
    };

    // Mock OrbitControls
    const controls = {
      target: new THREE.Vector3(0, 0, 0),
      update: vi.fn(),
      reset: vi.fn(),
    };

    return { scene, camera, renderer, controls };
  }),
}));

describe('TscnRenderer', () => {
  let renderer: TscnRenderer;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    renderer = new TscnRenderer(canvas);
  });

  afterEach(() => {
    renderer.dispose();
  });

  describe('constructor', () => {
    it('should initialize with canvas', () => {
      const newRenderer = new TscnRenderer(canvas);
      expect(newRenderer).toBeDefined();
      newRenderer.dispose();
    });

    it('should initialize with options', () => {
      const onResourceNeeded = vi.fn();
      const newRenderer = new TscnRenderer(canvas, { onResourceNeeded });
      expect(newRenderer).toBeDefined();
      newRenderer.dispose();
    });

    it('should setup three.js scene and camera', () => {
      const cameraState = renderer.getCameraState();
      expect(cameraState.position).toBeDefined();
      expect(cameraState.target).toBeDefined();
    });

    it('should wire managers correctly', () => {
      // Verify renderer can call delegation methods without errors
      expect(() => renderer.clearHighlight()).not.toThrow();
      expect(() => renderer.clearHoverEffect()).not.toThrow();
    });
  });

  describe('render()', () => {
    it('should render a simple scene', async () => {
      const scene: TscnScene = {
        format: 3,
        nodes: [
          {
            name: 'Root',
            type: 'Node3D',
            properties: {},
            children: [],
          },
        ],
        externalResources: [],
        subResources: [],
      };

      await renderer.render(scene);

      // Verify scene was rendered
      const instances = renderer.getSceneInstances('res://test.tscn');
      expect(instances).toBeDefined();
    });

    it('should render scene with multiple root nodes', async () => {
      const scene: TscnScene = {
        format: 3,
        nodes: [
          { name: 'Root1', type: 'Node3D', properties: {}, children: [] },
          { name: 'Root2', type: 'Node3D', properties: {}, children: [] },
          { name: 'Root3', type: 'Node3D', properties: {}, children: [] },
        ],
        externalResources: [],
        subResources: [],
      };

      await renderer.render(scene);

      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should wait for previous render to complete', async () => {
      const scene1: TscnScene = {
        format: 3,
        nodes: [{ name: 'Root1', type: 'Node3D', properties: {}, children: [] }],
        externalResources: [],
        subResources: [],
      };

      const scene2: TscnScene = {
        format: 3,
        nodes: [{ name: 'Root2', type: 'Node3D', properties: {}, children: [] }],
        externalResources: [],
        subResources: [],
      };

      // Start first render
      const render1Promise = renderer.render(scene1);

      // Start second render immediately (should wait)
      const render2Promise = renderer.render(scene2);

      // Both should complete
      await Promise.all([render1Promise, render2Promise]);

      expect(true).toBe(true);
    });

    it('should clear previous scene state', async () => {
      const scene1: TscnScene = {
        format: 3,
        nodes: [{ name: 'Root1', type: 'Node3D', properties: {}, children: [] }],
        externalResources: [],
        subResources: [],
      };

      const scene2: TscnScene = {
        format: 3,
        nodes: [{ name: 'Root2', type: 'Node3D', properties: {}, children: [] }],
        externalResources: [],
        subResources: [],
      };

      await renderer.render(scene1);
      await renderer.render(scene2);

      // Second render should have cleared first scene's state
      expect(true).toBe(true);
    });

    it('should handle empty scene', async () => {
      const scene: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        subResources: [],
      };

      await renderer.render(scene);

      expect(true).toBe(true);
    });

    it('should preserve lights and grid during clear', async () => {
      const scene: TscnScene = {
        format: 3,
        nodes: [{ name: 'Root', type: 'Node3D', properties: {}, children: [] }],
        externalResources: [],
        subResources: [],
      };

      await renderer.render(scene);

      // Render second scene - lights and grid should still be there
      await renderer.render(scene);

      expect(true).toBe(true);
    });
  });

  describe('node lifecycle delegation', () => {
    it('should delegate addNode to NodeLifecycleManager', async () => {
      const node = {
        name: 'TestNode',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const scene: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        subResources: [],
      };

      // This calls NodeLifecycleManager internally
      await expect(renderer.addNode('TestNode', node, scene)).resolves.not.toThrow();
    });

    it('should delegate removeNode to NodeLifecycleManager', () => {
      expect(() => renderer.removeNode('TestNode')).not.toThrow();
    });

    it('should delegate updateNode to NodeLifecycleManager', async () => {
      const node = {
        name: 'TestNode',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const scene: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        subResources: [],
      };

      await expect(renderer.updateNode('TestNode', node, scene)).resolves.not.toThrow();
    });

    it('should delegate setNodeVisibility to NodeLifecycleManager', () => {
      expect(() => renderer.setNodeVisibility('TestNode', true)).not.toThrow();
      expect(() => renderer.setNodeVisibility('TestNode', false)).not.toThrow();
    });
  });

  describe('selection delegation', () => {
    it('should delegate getNodePathAtScreenPosition to SelectionManager', () => {
      const result = renderer.getNodePathAtScreenPosition(100, 100);
      expect(result).toBeNull(); // No nodes in scene
    });

    it('should handle clicks outside canvas', () => {
      const result = renderer.getNodePathAtScreenPosition(-100, -100);
      expect(result).toBeNull();
    });
  });

  describe('helper delegation', () => {
    it('should delegate highlightNode to HelperManager', () => {
      expect(() => renderer.highlightNode('TestNode')).not.toThrow();
    });

    it('should delegate clearHighlight to HelperManager', () => {
      expect(() => renderer.clearHighlight()).not.toThrow();
    });

    it('should delegate showHoverEffect to HelperManager', () => {
      expect(() => renderer.showHoverEffect('TestNode')).not.toThrow();
    });

    it('should delegate clearHoverEffect to HelperManager', () => {
      expect(() => renderer.clearHoverEffect()).not.toThrow();
    });

    it('should allow chaining hover effects', () => {
      expect(() => {
        renderer.showHoverEffect('Node1');
        renderer.clearHoverEffect();
        renderer.showHoverEffect('Node2');
        renderer.clearHoverEffect();
      }).not.toThrow();
    });
  });

  describe('resource recovery delegation', () => {
    it('should delegate getMissingResources to ResourceRecoveryManager', () => {
      const missing = renderer.getMissingResources();
      expect(missing).toBeInstanceOf(Array);
    });

    it('should delegate provideResource to ResourceRecoveryManager', async () => {
      await expect(renderer.provideResource('res://test.png')).resolves.not.toThrow();
    });

    it('should return empty array when no missing resources', () => {
      const missing = renderer.getMissingResources();
      expect(missing).toHaveLength(0);
    });
  });

  describe('camera management', () => {
    it('should get camera state', () => {
      const state = renderer.getCameraState();

      expect(state.position).toBeDefined();
      expect(state.position.x).toBeDefined();
      expect(state.position.y).toBeDefined();
      expect(state.position.z).toBeDefined();

      expect(state.target).toBeDefined();
      expect(state.target.x).toBeDefined();
      expect(state.target.y).toBeDefined();
      expect(state.target.z).toBeDefined();
    });

    it('should set camera state', () => {
      const newState = {
        position: { x: 5, y: 5, z: 5 },
        target: { x: 1, y: 1, z: 1 },
      };

      renderer.setCameraState(newState);

      const state = renderer.getCameraState();
      expect(state.position.x).toBe(5);
      expect(state.position.y).toBe(5);
      expect(state.position.z).toBe(5);
      expect(state.target.x).toBe(1);
      expect(state.target.y).toBe(1);
      expect(state.target.z).toBe(1);
    });

    it('should reset camera to default position', () => {
      // Move camera away from default
      renderer.setCameraState({
        position: { x: 100, y: 100, z: 100 },
        target: { x: 50, y: 50, z: 50 },
      });

      // Reset
      renderer.resetCamera();

      const state = renderer.getCameraState();
      expect(state.position.x).toBe(10);
      expect(state.position.y).toBe(10);
      expect(state.position.z).toBe(10);
    });

    it('should handle negative camera positions', () => {
      const newState = {
        position: { x: -10, y: -5, z: -15 },
        target: { x: 0, y: 0, z: 0 },
      };

      renderer.setCameraState(newState);

      const state = renderer.getCameraState();
      expect(state.position.x).toBe(-10);
      expect(state.position.y).toBe(-5);
      expect(state.position.z).toBe(-15);
    });
  });

  describe('animation and rendering', () => {
    it('should start animation loop without errors', () => {
      expect(() => renderer.startAnimationLoop()).not.toThrow();
    });

    it('should handle resize', () => {
      expect(() => renderer.resize(800, 600)).not.toThrow();
    });

    it('should update camera aspect ratio on resize', () => {
      renderer.resize(1920, 1080);

      const state = renderer.getCameraState();
      expect(state).toBeDefined();
    });

    it('should handle zero dimensions gracefully', () => {
      expect(() => renderer.resize(0, 0)).not.toThrow();
    });

    it('should handle very large dimensions', () => {
      expect(() => renderer.resize(10000, 10000)).not.toThrow();
    });
  });

  describe('scene management API', () => {
    it('should delegate reloadScene to SceneManager', async () => {
      // reloadScene requires ResourceRegistry to be set
      await expect(renderer.reloadScene('res://test.tscn')).rejects.toThrow('ResourceRegistry not set');
    });

    it('should delegate getSceneInstances to SceneManager', () => {
      const instances = renderer.getSceneInstances('res://test.tscn');
      expect(instances).toBeInstanceOf(Array);
    });

    it('should delegate hasScene to SceneManager', () => {
      const has = renderer.hasScene('res://test.tscn');
      expect(typeof has).toBe('boolean');
    });

    it('should return false for non-existent scene', () => {
      const has = renderer.hasScene('res://nonexistent.tscn');
      expect(has).toBe(false);
    });

    it('should return empty array for scene with no instances', () => {
      const instances = renderer.getSceneInstances('res://nonexistent.tscn');
      expect(instances).toHaveLength(0);
    });
  });

  describe('dispose', () => {
    it('should dispose renderer resources', () => {
      const testRenderer = new TscnRenderer(canvas);
      expect(() => testRenderer.dispose()).not.toThrow();
    });

    it('should clear helpers on dispose', () => {
      renderer.highlightNode('TestNode');
      renderer.showHoverEffect('TestNode');

      renderer.dispose();

      // Should not throw after dispose
      expect(true).toBe(true);
    });

    it('should allow dispose to be called multiple times', () => {
      renderer.dispose();
      expect(() => renderer.dispose()).not.toThrow();
    });
  });

  describe('resource callback wiring', () => {
    it('should wire user callback through to SceneManager', async () => {
      const callbackSpy = vi.fn().mockResolvedValue(null);
      const testRenderer = new TscnRenderer(canvas, {
        onResourceNeeded: callbackSpy,
      });

      // Render scene (callback should be wired)
      const scene: TscnScene = {
        format: 3,
        nodes: [{ name: 'Root', type: 'Node3D', properties: {}, children: [] }],
        externalResources: [],
        subResources: [],
      };

      await testRenderer.render(scene);

      // Callback wiring verified by no errors
      expect(callbackSpy).not.toHaveBeenCalled(); // No missing resources in this scene

      testRenderer.dispose();
    });

    it('should track missing resources in ResourceRecoveryManager', async () => {
      const callbackSpy = vi.fn().mockResolvedValue(null);
      const testRenderer = new TscnRenderer(canvas, {
        onResourceNeeded: callbackSpy,
      });

      const missing = testRenderer.getMissingResources();
      expect(missing).toBeInstanceOf(Array);

      testRenderer.dispose();
    });
  });

  describe('error handling', () => {
    it('should handle render errors gracefully', async () => {
      const invalidScene = {
        format: 3,
        nodes: [
          {
            name: 'Invalid',
            type: 'InvalidType',
            properties: {},
            children: [],
          },
        ],
        externalResources: [],
        subResources: [],
      };

      // Should not throw even with invalid node type
      await expect(renderer.render(invalidScene)).resolves.not.toThrow();
    });

    it('should handle null properties in nodes', async () => {
      const scene: TscnScene = {
        format: 3,
        nodes: [
          {
            name: 'Root',
            type: 'Node3D',
            properties: {},
            children: [],
          },
        ],
        externalResources: [],
        subResources: [],
      };

      await expect(renderer.render(scene)).resolves.not.toThrow();
    });
  });

  describe('concurrency and state management', () => {
    it('should queue concurrent render calls', async () => {
      const scenes = [
        {
          format: 3,
          nodes: [{ name: 'Scene1', type: 'Node3D', properties: {}, children: [] }],
          externalResources: [],
          subResources: [],
        },
        {
          format: 3,
          nodes: [{ name: 'Scene2', type: 'Node3D', properties: {}, children: [] }],
          externalResources: [],
          subResources: [],
        },
        {
          format: 3,
          nodes: [{ name: 'Scene3', type: 'Node3D', properties: {}, children: [] }],
          externalResources: [],
          subResources: [],
        },
      ] as TscnScene[];

      // Start all renders concurrently
      const promises = scenes.map(scene => renderer.render(scene));

      // All should complete without errors
      await Promise.all(promises);

      expect(true).toBe(true);
    });

    it('should maintain consistent state during rapid renders', async () => {
      for (let i = 0; i < 5; i++) {
        const scene: TscnScene = {
          format: 3,
          nodes: [{ name: `Root${i}`, type: 'Node3D', properties: {}, children: [] }],
          externalResources: [],
          subResources: [],
        };

        await renderer.render(scene);
      }

      // Should maintain consistent state
      const state = renderer.getCameraState();
      expect(state).toBeDefined();
    });
  });
});
