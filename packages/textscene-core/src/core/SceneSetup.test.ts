/**
 * Tests for SceneSetup - Three.js scene initialization utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  createDefaultScene,
  createDefaultCamera,
  createRenderer,
  createOrbitControls,
  setupThreeJsScene
} from './SceneSetup';

// Mock WebGLRenderer
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof THREE>();

  class MockWebGLRenderer {
    domElement: HTMLCanvasElement;
    render = vi.fn();
    setSize = vi.fn();
    dispose = vi.fn();
    shadowMap = { enabled: false };

    constructor(options?: { canvas?: HTMLCanvasElement; antialias?: boolean }) {
      this.domElement = options?.canvas || document.createElement('canvas');
    }
  }

  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer
  };
});

describe('SceneSetup', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
  });

  describe('createDefaultScene', () => {
    it('should create a THREE.Scene', () => {
      const scene = createDefaultScene();
      expect(scene).toBeInstanceOf(THREE.Scene);
    });

    it('should set background color', () => {
      const scene = createDefaultScene();
      expect(scene.background).toBeInstanceOf(THREE.Color);
      expect((scene.background as THREE.Color).getHex()).toBe(0x2a2a2a);
    });

    it('should add ambient light', () => {
      const scene = createDefaultScene();
      const ambientLights = scene.children.filter(child => child instanceof THREE.AmbientLight);
      expect(ambientLights.length).toBe(1);

      const ambientLight = ambientLights[0] as THREE.AmbientLight;
      expect(ambientLight.intensity).toBe(0.6);
      expect(ambientLight.color.getHex()).toBe(0xffffff);
    });

    it('should add directional light', () => {
      const scene = createDefaultScene();
      const directionalLights = scene.children.filter(child => child instanceof THREE.DirectionalLight);
      expect(directionalLights.length).toBe(1);

      const directionalLight = directionalLights[0] as THREE.DirectionalLight;
      expect(directionalLight.intensity).toBe(0.8);
      expect(directionalLight.position.x).toBe(10);
      expect(directionalLight.position.y).toBe(10);
      expect(directionalLight.position.z).toBe(10);
      expect(directionalLight.color.getHex()).toBe(0xffffff);
    });

    it('should add grid helper', () => {
      const scene = createDefaultScene();
      const gridHelpers = scene.children.filter(child => child instanceof THREE.GridHelper);
      expect(gridHelpers.length).toBe(1);
    });

    it('should have exactly 3 children (ambient light, directional light, grid)', () => {
      const scene = createDefaultScene();
      expect(scene.children.length).toBe(3);
    });

    it('should create independent scenes', () => {
      const scene1 = createDefaultScene();
      const scene2 = createDefaultScene();

      expect(scene1).not.toBe(scene2);
      expect(scene1.children).not.toBe(scene2.children);
    });
  });

  describe('createDefaultCamera', () => {
    it('should create a PerspectiveCamera', () => {
      const camera = createDefaultCamera(canvas);
      expect(camera).toBeInstanceOf(THREE.PerspectiveCamera);
    });

    it('should set correct field of view', () => {
      const camera = createDefaultCamera(canvas);
      expect(camera.fov).toBe(75);
    });

    it('should set correct aspect ratio', () => {
      const camera = createDefaultCamera(canvas);
      expect(camera.aspect).toBe(canvas.width / canvas.height);
      expect(camera.aspect).toBe(800 / 600);
    });

    it('should set correct near and far clipping planes', () => {
      const camera = createDefaultCamera(canvas);
      expect(camera.near).toBe(0.1);
      expect(camera.far).toBe(1000);
    });

    it('should position camera at (10, 10, 10)', () => {
      const camera = createDefaultCamera(canvas);
      expect(camera.position.x).toBe(10);
      expect(camera.position.y).toBe(10);
      expect(camera.position.z).toBe(10);
    });

    it('should point camera at origin', () => {
      const camera = createDefaultCamera(canvas);
      // Camera lookAt modifies the rotation matrix
      // We can verify it's looking at origin by checking the direction
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);

      // Camera should be looking towards origin from (10, 10, 10)
      const expectedDirection = new THREE.Vector3(-10, -10, -10).normalize();
      expect(direction.x).toBeCloseTo(expectedDirection.x, 5);
      expect(direction.y).toBeCloseTo(expectedDirection.y, 5);
      expect(direction.z).toBeCloseTo(expectedDirection.z, 5);
    });

    it('should handle different canvas aspect ratios', () => {
      canvas.width = 1920;
      canvas.height = 1080;

      const camera = createDefaultCamera(canvas);
      expect(camera.aspect).toBe(1920 / 1080);
    });
  });

  describe('createRenderer', () => {
    it('should create a WebGLRenderer with mocked implementation', () => {
      const renderer = createRenderer(canvas);
      expect(renderer).toBeDefined();
      expect(renderer.domElement).toBe(canvas);
    });

    it('should call setSize with canvas dimensions', () => {
      const renderer = createRenderer(canvas);
      expect(renderer.setSize).toHaveBeenCalledWith(800, 600);
    });

    it('should pass canvas to renderer', () => {
      const renderer = createRenderer(canvas);
      expect(renderer.domElement).toBe(canvas);
    });
  });

  describe('createOrbitControls', () => {
    it('should create OrbitControls', () => {
      const camera = createDefaultCamera(canvas);
      const controls = createOrbitControls(camera, canvas);
      expect(controls).toBeInstanceOf(OrbitControls);
    });

    it('should enable damping', () => {
      const camera = createDefaultCamera(canvas);
      const controls = createOrbitControls(camera, canvas);
      expect(controls.enableDamping).toBe(true);
    });

    it('should set damping factor', () => {
      const camera = createDefaultCamera(canvas);
      const controls = createOrbitControls(camera, canvas);
      expect(controls.dampingFactor).toBe(0.05);
    });

    it('should attach controls to camera', () => {
      const camera = createDefaultCamera(canvas);
      const controls = createOrbitControls(camera, canvas);
      expect(controls.object).toBe(camera);
    });
  });

  describe('setupThreeJsScene', () => {
    it('should return all scene components', () => {
      const components = setupThreeJsScene(canvas);

      expect(components.scene).toBeDefined();
      expect(components.camera).toBeDefined();
      expect(components.renderer).toBeDefined();
      expect(components.controls).toBeDefined();
    });

    it('should return correct component types', () => {
      const components = setupThreeJsScene(canvas);

      expect(components.scene).toBeInstanceOf(THREE.Scene);
      expect(components.camera).toBeInstanceOf(THREE.PerspectiveCamera);
      expect(components.controls).toBeInstanceOf(OrbitControls);
    });

    it('should setup scene with lights and grid', () => {
      const components = setupThreeJsScene(canvas);

      // Verify scene has default children (2 lights + grid)
      expect(components.scene.children.length).toBe(3);
    });

    it('should setup camera with correct position', () => {
      const components = setupThreeJsScene(canvas);

      expect(components.camera.position.x).toBeCloseTo(10);
      expect(components.camera.position.y).toBeCloseTo(10);
      expect(components.camera.position.z).toBeCloseTo(10);
    });

    it('should setup controls with damping enabled', () => {
      const components = setupThreeJsScene(canvas);

      expect(components.controls.enableDamping).toBe(true);
      expect(components.controls.dampingFactor).toBe(0.05);
    });

    it('should link controls to camera and canvas', () => {
      const components = setupThreeJsScene(canvas);

      expect(components.controls.object).toBe(components.camera);
      expect(components.controls.domElement).toBe(canvas);
    });

    it('should configure renderer with canvas', () => {
      const components = setupThreeJsScene(canvas);

      expect(components.renderer.domElement).toBe(canvas);
      expect(components.renderer.setSize).toHaveBeenCalledWith(800, 600);
    });

    it('should create independent scene setups', () => {
      const components1 = setupThreeJsScene(canvas);
      const components2 = setupThreeJsScene(canvas);

      expect(components1.scene).not.toBe(components2.scene);
      expect(components1.camera).not.toBe(components2.camera);
      expect(components1.controls).not.toBe(components2.controls);
    });
  });

  describe('Integration', () => {
    it('should create complete working three.js scene', () => {
      const components = setupThreeJsScene(canvas);

      // Add a test object to the scene
      const testMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial()
      );
      components.scene.add(testMesh);

      // Verify scene graph
      expect(components.scene.children).toContain(testMesh);
      expect(components.scene.children.length).toBe(4); // 3 default + test mesh

      // Verify camera can see the scene
      expect(components.camera.position.length()).toBeGreaterThan(0);

      // Verify controls are functional
      expect(components.controls.target).toBeInstanceOf(THREE.Vector3);
    });

    it('should allow rendering the scene', () => {
      const components = setupThreeJsScene(canvas);

      // Should be able to call render without errors
      expect(() => {
        components.renderer.render(components.scene, components.camera);
      }).not.toThrow();

      expect(components.renderer.render).toHaveBeenCalled();
    });

    it('should allow control updates', () => {
      const components = setupThreeJsScene(canvas);

      // Should be able to update controls
      expect(() => {
        components.controls.update();
      }).not.toThrow();
    });
  });
});
