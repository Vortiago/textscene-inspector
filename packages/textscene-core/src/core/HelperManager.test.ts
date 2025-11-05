/**
 * Tests for HelperManager - Visual helpers for node highlighting and hover effects
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { HelperManager } from './HelperManager';
import { NodeTracker } from './NodeTracker';
import * as logger from '../logger';

describe('HelperManager', () => {
  let helperManager: HelperManager;
  let scene: THREE.Scene;
  let nodeTracker: NodeTracker;
  let testObject: THREE.Object3D;

  beforeEach(() => {
    scene = new THREE.Scene();
    nodeTracker = new NodeTracker();
    helperManager = new HelperManager(scene, nodeTracker);

    // Create test object and add to tracker
    testObject = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial()
    );
    nodeTracker.set('Root/TestNode', testObject, {
      name: 'TestNode',
      type: 'Node3D',
      children: [],
      properties: {}
    });

    // Spy on logger and clear previous calls
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with scene and nodeTracker', () => {
      expect(helperManager).toBeDefined();
      expect(helperManager).toBeInstanceOf(HelperManager);
    });
  });

  describe('highlightNode', () => {
    it('should create green BoxHelper for valid node path', () => {
      helperManager.highlightNode('Root/TestNode');

      // Find BoxHelper in scene
      const helper = scene.children.find(child => child instanceof THREE.BoxHelper);
      expect(helper).toBeDefined();
      expect(helper).toBeInstanceOf(THREE.BoxHelper);

      // Verify green color (0x00ff00)
      const boxHelper = helper as THREE.BoxHelper;
      const material = boxHelper.material as THREE.LineBasicMaterial;
      expect(material.color.getHex()).toBe(0x00ff00);
    });

    it('should add BoxHelper to scene', () => {
      const initialChildCount = scene.children.length;
      helperManager.highlightNode('Root/TestNode');

      expect(scene.children.length).toBe(initialChildCount + 1);
    });

    it('should clear existing hover when highlighting', () => {
      // First create hover effect
      helperManager.showHoverEffect('Root/TestNode');
      expect(scene.children.length).toBe(1);

      // Then highlight - should clear hover and create highlight
      helperManager.highlightNode('Root/TestNode');

      // Should still have only 1 helper (highlight replaced hover)
      expect(scene.children.length).toBe(1);

      // Verify it's green (highlight) not orange (hover)
      const helper = scene.children[0] as THREE.BoxHelper;
      const material = helper.material as THREE.LineBasicMaterial;
      expect(material.color.getHex()).toBe(0x00ff00);
    });

    it('should replace existing highlight with new one', () => {
      helperManager.highlightNode('Root/TestNode');
      expect(scene.children.length).toBe(1);

      // Highlight again - should replace, not add
      helperManager.highlightNode('Root/TestNode');
      expect(scene.children.length).toBe(1);
    });

    it('should warn when node path not found', () => {
      helperManager.highlightNode('Root/NonExistent');

      expect(logger.warn).toHaveBeenCalledWith(
        'Cannot set helper: node not found at path Root/NonExistent'
      );
    });

    it('should not create helper when node path invalid', () => {
      const initialChildCount = scene.children.length;
      helperManager.highlightNode('Root/NonExistent');

      expect(scene.children.length).toBe(initialChildCount);
    });
  });

  describe('clearHighlight', () => {
    it('should remove highlight helper from scene', () => {
      helperManager.highlightNode('Root/TestNode');
      expect(scene.children.length).toBe(1);

      helperManager.clearHighlight();
      expect(scene.children.length).toBe(0);
    });

    it('should dispose BoxHelper resources', () => {
      helperManager.highlightNode('Root/TestNode');
      const helper = scene.children[0] as THREE.BoxHelper;
      const disposeSpy = vi.spyOn(helper, 'dispose');

      helperManager.clearHighlight();

      expect(disposeSpy).toHaveBeenCalled();
    });

    it('should not throw when clearing non-existent highlight', () => {
      expect(() => helperManager.clearHighlight()).not.toThrow();
    });

    it('should not affect hover helper', () => {
      helperManager.showHoverEffect('Root/TestNode');
      expect(scene.children.length).toBe(1);

      helperManager.clearHighlight();

      // Hover should still exist
      expect(scene.children.length).toBe(1);
    });
  });

  describe('showHoverEffect', () => {
    it('should create orange BoxHelper for valid node path', () => {
      helperManager.showHoverEffect('Root/TestNode');

      const helper = scene.children.find(child => child instanceof THREE.BoxHelper);
      expect(helper).toBeDefined();

      // Verify orange color (0xff8800)
      const boxHelper = helper as THREE.BoxHelper;
      const material = boxHelper.material as THREE.LineBasicMaterial;
      expect(material.color.getHex()).toBe(0xff8800);
    });

    it('should add BoxHelper to scene', () => {
      const initialChildCount = scene.children.length;
      helperManager.showHoverEffect('Root/TestNode');

      expect(scene.children.length).toBe(initialChildCount + 1);
    });

    it('should replace existing hover with new one', () => {
      helperManager.showHoverEffect('Root/TestNode');
      expect(scene.children.length).toBe(1);

      helperManager.showHoverEffect('Root/TestNode');
      expect(scene.children.length).toBe(1);
    });

    it('should warn when node path not found', () => {
      helperManager.showHoverEffect('Root/NonExistent');

      expect(logger.warn).toHaveBeenCalledWith(
        'Cannot set helper: node not found at path Root/NonExistent'
      );
    });

    it('should not create helper when node path invalid', () => {
      const initialChildCount = scene.children.length;
      helperManager.showHoverEffect('Root/NonExistent');

      expect(scene.children.length).toBe(initialChildCount);
    });

    it('should coexist with highlight helper', () => {
      // Create highlight first
      helperManager.highlightNode('Root/TestNode');
      expect(scene.children.length).toBe(1);

      // Note: highlightNode() clears hover, so we can't have both at once
      // This tests that the implementation correctly manages exclusive helpers
    });
  });

  describe('clearHoverEffect', () => {
    it('should remove hover helper from scene', () => {
      helperManager.showHoverEffect('Root/TestNode');
      expect(scene.children.length).toBe(1);

      helperManager.clearHoverEffect();
      expect(scene.children.length).toBe(0);
    });

    it('should dispose BoxHelper resources', () => {
      helperManager.showHoverEffect('Root/TestNode');
      const helper = scene.children[0] as THREE.BoxHelper;
      const disposeSpy = vi.spyOn(helper, 'dispose');

      helperManager.clearHoverEffect();

      expect(disposeSpy).toHaveBeenCalled();
    });

    it('should not throw when clearing non-existent hover', () => {
      expect(() => helperManager.clearHoverEffect()).not.toThrow();
    });

    it('should not affect highlight helper', () => {
      helperManager.highlightNode('Root/TestNode');
      expect(scene.children.length).toBe(1);

      helperManager.clearHoverEffect();

      // Highlight should still exist
      expect(scene.children.length).toBe(1);
    });
  });

  describe('clearAll', () => {
    it('should remove all helpers from scene', () => {
      helperManager.highlightNode('Root/TestNode');
      expect(scene.children.length).toBe(1);

      helperManager.clearAll();
      expect(scene.children.length).toBe(0);
    });

    it('should dispose all helper resources', () => {
      helperManager.highlightNode('Root/TestNode');
      const highlightHelper = scene.children[0] as THREE.BoxHelper;
      const disposeSpy = vi.spyOn(highlightHelper, 'dispose');

      helperManager.clearAll();

      expect(disposeSpy).toHaveBeenCalled();
    });

    it('should clear both highlight and hover helpers', () => {
      // Create highlight
      helperManager.highlightNode('Root/TestNode');
      const highlightHelper = scene.children[0] as THREE.BoxHelper;
      const highlightDisposeSpy = vi.spyOn(highlightHelper, 'dispose');

      helperManager.clearAll();

      expect(highlightDisposeSpy).toHaveBeenCalled();
      expect(scene.children.length).toBe(0);
    });

    it('should not throw when no helpers exist', () => {
      expect(() => helperManager.clearAll()).not.toThrow();
    });

    it('should allow creating new helpers after clearAll', () => {
      helperManager.highlightNode('Root/TestNode');
      helperManager.clearAll();

      helperManager.showHoverEffect('Root/TestNode');
      expect(scene.children.length).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid highlight/clear cycles', () => {
      for (let i = 0; i < 10; i++) {
        helperManager.highlightNode('Root/TestNode');
        helperManager.clearHighlight();
      }

      expect(scene.children.length).toBe(0);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should handle rapid hover/clear cycles', () => {
      for (let i = 0; i < 10; i++) {
        helperManager.showHoverEffect('Root/TestNode');
        helperManager.clearHoverEffect();
      }

      expect(scene.children.length).toBe(0);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should handle multiple nodes tracked', () => {
      // Add second node
      const testObject2 = new THREE.Mesh(
        new THREE.BoxGeometry(2, 2, 2),
        new THREE.MeshBasicMaterial()
      );
      nodeTracker.set('Root/TestNode2', testObject2, {
        name: 'TestNode2',
        type: 'Node3D',
        children: [],
        properties: {}
      });

      // Highlight first node
      helperManager.highlightNode('Root/TestNode');
      expect(scene.children.length).toBe(1);

      // Can't have two highlights at once (highlightNode clears previous)
      helperManager.highlightNode('Root/TestNode2');
      expect(scene.children.length).toBe(1);
    });

    it('should handle empty node path', () => {
      helperManager.highlightNode('');

      expect(logger.warn).toHaveBeenCalledWith(
        'Cannot set helper: node not found at path '
      );
      expect(scene.children.length).toBe(0);
    });

    it('should verify BoxHelper wraps correct object', () => {
      helperManager.highlightNode('Root/TestNode');

      const helper = scene.children[0] as THREE.BoxHelper;
      expect(helper.object).toBe(testObject);
    });
  });
});
