/**
 * Unit tests for ResourceRecoveryManager
 * Ensures missing resources are tracked and recovery workflow works correctly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResourceRecoveryManager } from './ResourceRecoveryManager';
import { NodeTracker } from './NodeTracker';
import { SceneManager } from './SceneManager';
import { TscnParser } from '../parser/TscnParser';
import type { MissingResource } from '../parser/types';

describe('ResourceRecoveryManager', () => {
  let resourceRecovery: ResourceRecoveryManager;
  let nodeTracker: NodeTracker;
  let sceneManager: SceneManager;

  beforeEach(() => {
    nodeTracker = new NodeTracker();
    const parser = new TscnParser();
    sceneManager = new SceneManager(parser, nodeTracker);

    resourceRecovery = new ResourceRecoveryManager(
      nodeTracker,
      sceneManager,
      () => null // getCurrentSceneData
    );
  });

  describe('recordMissing()', () => {
    it('should record a missing resource', () => {
      const missingResource: MissingResource = {
        path: 'res://scenes/Enemy.tscn',
        type: 'PackedScene',
        referencedBy: 'MainScene/EnemyInstance',
        error: 'File not found'
      };

      resourceRecovery.recordMissing(missingResource);

      const missing = resourceRecovery.getMissingResources();
      expect(missing).toHaveLength(1);
      expect(missing[0]).toEqual(missingResource);
    });

    it('should replace existing missing resource with same path', () => {
      const missingResource1: MissingResource = {
        path: 'res://scenes/Enemy.tscn',
        type: 'PackedScene',
        referencedBy: 'MainScene/EnemyInstance1',
        error: 'File not found'
      };

      const missingResource2: MissingResource = {
        path: 'res://scenes/Enemy.tscn',
        type: 'PackedScene',
        referencedBy: 'MainScene/EnemyInstance2',
        error: 'Different error'
      };

      resourceRecovery.recordMissing(missingResource1);
      resourceRecovery.recordMissing(missingResource2);

      const missing = resourceRecovery.getMissingResources();
      expect(missing).toHaveLength(1);
      expect(missing[0]).toEqual(missingResource2);
    });

    it('should track multiple different missing resources', () => {
      const missing1: MissingResource = {
        path: 'res://scenes/Enemy.tscn',
        type: 'PackedScene',
        referencedBy: 'MainScene/Enemy',
        error: 'File not found'
      };

      const missing2: MissingResource = {
        path: 'res://scenes/Player.tscn',
        type: 'PackedScene',
        referencedBy: 'MainScene/Player',
        error: 'File not found'
      };

      const missing3: MissingResource = {
        path: 'res://textures/wall.png',
        type: 'Texture2D',
        referencedBy: 'MainScene/Wall',
        error: 'File not found'
      };

      resourceRecovery.recordMissing(missing1);
      resourceRecovery.recordMissing(missing2);
      resourceRecovery.recordMissing(missing3);

      const missing = resourceRecovery.getMissingResources();
      expect(missing).toHaveLength(3);
      expect(missing).toContainEqual(missing1);
      expect(missing).toContainEqual(missing2);
      expect(missing).toContainEqual(missing3);
    });
  });

  describe('getMissingResources()', () => {
    it('should return empty array when no resources are missing', () => {
      const missing = resourceRecovery.getMissingResources();
      expect(missing).toEqual([]);
    });

    it('should return all recorded missing resources', () => {
      const missing1: MissingResource = {
        path: 'res://scenes/Enemy.tscn',
        type: 'PackedScene',
        referencedBy: 'MainScene/Enemy',
      };

      const missing2: MissingResource = {
        path: 'res://scenes/Player.tscn',
        type: 'PackedScene',
        referencedBy: 'MainScene/Player',
      };

      resourceRecovery.recordMissing(missing1);
      resourceRecovery.recordMissing(missing2);

      const missing = resourceRecovery.getMissingResources();
      expect(missing).toHaveLength(2);
    });
  });

  describe('clear()', () => {
    it('should clear all missing resources', () => {
      const missingResource: MissingResource = {
        path: 'res://scenes/Enemy.tscn',
        type: 'PackedScene',
        referencedBy: 'MainScene/Enemy',
      };

      resourceRecovery.recordMissing(missingResource);
      expect(resourceRecovery.getMissingResources()).toHaveLength(1);

      resourceRecovery.clear();
      expect(resourceRecovery.getMissingResources()).toHaveLength(0);
    });
  });

  describe('provideResource()', () => {
    it('should call sceneManager.provideScene() for missing resource', async () => {
      const missingResource: MissingResource = {
        path: 'res://scenes/Enemy.tscn',
        type: 'PackedScene',
        referencedBy: 'MainScene/Enemy',
      };

      resourceRecovery.recordMissing(missingResource);

      const provideSceneSpy = vi.spyOn(sceneManager, 'provideScene').mockResolvedValue();

      await resourceRecovery.provideResource('res://scenes/Enemy.tscn');

      expect(provideSceneSpy).toHaveBeenCalledWith('res://scenes/Enemy.tscn');
    });

    it('should remove resource from missing list on successful load', async () => {
      const missingResource: MissingResource = {
        path: 'res://scenes/Enemy.tscn',
        type: 'PackedScene',
        referencedBy: 'MainScene/Enemy',
      };

      resourceRecovery.recordMissing(missingResource);
      expect(resourceRecovery.getMissingResources()).toHaveLength(1);

      vi.spyOn(sceneManager, 'provideScene').mockResolvedValue();

      await resourceRecovery.provideResource('res://scenes/Enemy.tscn');

      expect(resourceRecovery.getMissingResources()).toHaveLength(0);
    });

    it('should keep resource in missing list if load fails', async () => {
      const missingResource: MissingResource = {
        path: 'res://scenes/Enemy.tscn',
        type: 'PackedScene',
        referencedBy: 'MainScene/Enemy',
        error: 'File not found'
      };

      resourceRecovery.recordMissing(missingResource);

      vi.spyOn(sceneManager, 'provideScene').mockRejectedValue(new Error('Still not found'));

      await resourceRecovery.provideResource('res://scenes/Enemy.tscn');

      const missing = resourceRecovery.getMissingResources();
      expect(missing).toHaveLength(1);
      expect(missing[0]).toEqual(missingResource);
    });

    it('should do nothing if resource was not missing', async () => {
      const provideSceneSpy = vi.spyOn(sceneManager, 'provideScene').mockResolvedValue();

      await resourceRecovery.provideResource('res://scenes/NotMissing.tscn');

      expect(provideSceneSpy).not.toHaveBeenCalled();
    });
  });

  describe('Integration with SceneManager', () => {
    it('should work with multiple resources in sequence', async () => {
      const missing1: MissingResource = {
        path: 'res://scenes/Enemy.tscn',
        type: 'PackedScene',
        referencedBy: 'MainScene/Enemy',
      };

      const missing2: MissingResource = {
        path: 'res://scenes/Player.tscn',
        type: 'PackedScene',
        referencedBy: 'MainScene/Player',
      };

      resourceRecovery.recordMissing(missing1);
      resourceRecovery.recordMissing(missing2);
      expect(resourceRecovery.getMissingResources()).toHaveLength(2);

      // Provide first resource successfully
      vi.spyOn(sceneManager, 'provideScene').mockResolvedValue();
      await resourceRecovery.provideResource('res://scenes/Enemy.tscn');
      expect(resourceRecovery.getMissingResources()).toHaveLength(1);

      // Provide second resource successfully
      await resourceRecovery.provideResource('res://scenes/Player.tscn');
      expect(resourceRecovery.getMissingResources()).toHaveLength(0);
    });
  });
});
