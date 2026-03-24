/**
 * Tests for shared test utilities
 */

import { describe, it, expect } from 'vitest';
import {
  createMockRenderer,
  createMockLogger,
  createTscnScene,
  createTscnNode,
  createNodeWithChildren,
  assertDefined,
  expectExactValue,
} from './testHelpers';

describe('testHelpers', () => {
  describe('createMockRenderer', () => {
    it('should create a mock renderer with essential properties', () => {
      const renderer = createMockRenderer();

      expect(renderer.render).toBeDefined();
      expect(renderer.setSize).toBeDefined();
      expect(renderer.dispose).toBeDefined();
      expect(renderer.domElement).toBeInstanceOf(HTMLCanvasElement);
      expect(renderer.shadowMap).toBeDefined();
    });

    it('should have callable mock methods', () => {
      const renderer = createMockRenderer();

      expect(() => renderer.render({} as any, {} as any)).not.toThrow();
      expect(() => renderer.setSize(800, 600)).not.toThrow();
      expect(() => renderer.dispose()).not.toThrow();
    });
  });

  describe('createMockLogger', () => {
    it('should create logger with all spy methods', () => {
      const logger = createMockLogger();

      expect(logger.warn).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.debug).toBeDefined();
    });

    it('should track calls to logger methods', () => {
      const logger = createMockLogger();

      logger.warn('test warning');
      logger.error('test error');
      logger.info('test info');
      logger.debug('test debug');

      expect(logger.warn).toHaveBeenCalledWith('test warning');
      expect(logger.error).toHaveBeenCalledWith('test error');
      expect(logger.info).toHaveBeenCalledWith('test info');
      expect(logger.debug).toHaveBeenCalledWith('test debug');
    });
  });

  describe('createTscnScene', () => {
    it('should create empty scene by default', () => {
      const scene = createTscnScene();

      expect(scene.nodes).toEqual([]);
      expect(scene.externalResources).toEqual([]);
      expect(scene.internalResources).toEqual([]);
    });

    it('should create scene with nodes', () => {
      const node = createTscnNode({ name: 'TestNode' });
      const scene = createTscnScene([node]);

      expect(scene.nodes).toHaveLength(1);
      expect(scene.nodes[0].name).toBe('TestNode');
    });

    it('should create scene with resources', () => {
      const externalResources = [{ id: '1', path: 'res://test.tscn', type: 'PackedScene' }];
      const internalResources = [{ id: '2', type: 'BoxMesh', data: {} }];

      const scene = createTscnScene([], { externalResources, internalResources });

      expect(scene.externalResources).toHaveLength(1);
      expect(scene.internalResources).toHaveLength(1);
      expect(scene.externalResources[0].path).toBe('res://test.tscn');
    });
  });

  describe('createTscnNode', () => {
    it('should create node with default values', () => {
      const node = createTscnNode();

      expect(node.name).toBe('TestNode');
      expect(node.type).toBe('Node3D');
      expect(node.properties).toEqual({});
      expect(node.children).toEqual([]);
    });

    it('should override default values', () => {
      const node = createTscnNode({
        name: 'CustomNode',
        type: 'MeshInstance3D',
        properties: { visible: false },
      });

      expect(node.name).toBe('CustomNode');
      expect(node.type).toBe('MeshInstance3D');
      expect(node.properties).toEqual({ visible: false });
    });

    it('should preserve children when provided', () => {
      const child = createTscnNode({ name: 'Child' });
      const parent = createTscnNode({ name: 'Parent', children: [child] });

      expect(parent.children).toHaveLength(1);
      expect(parent.children[0].name).toBe('Child');
    });
  });

  describe('createNodeWithChildren', () => {
    it('should create node with default 2 children', () => {
      const node = createNodeWithChildren('Parent');

      expect(node.name).toBe('Parent');
      expect(node.children).toHaveLength(2);
      expect(node.children[0].name).toBe('Parent_Child1');
      expect(node.children[1].name).toBe('Parent_Child2');
    });

    it('should create node with custom child count', () => {
      const node = createNodeWithChildren('Parent', 5);

      expect(node.children).toHaveLength(5);
      expect(node.children[0].name).toBe('Parent_Child1');
      expect(node.children[4].name).toBe('Parent_Child5');
    });

    it('should set parent reference for children', () => {
      const node = createNodeWithChildren('Parent', 3);

      expect(node.children[0].parent).toBe('Parent');
      expect(node.children[1].parent).toBe('Parent');
      expect(node.children[2].parent).toBe('Parent');
    });

    it('should create node with no children when count is 0', () => {
      const node = createNodeWithChildren('Parent', 0);

      expect(node.children).toEqual([]);
    });
  });

  describe('assertDefined', () => {
    it('should not throw for defined values', () => {
      expect(() => assertDefined('value')).not.toThrow();
      expect(() => assertDefined(0)).not.toThrow();
      expect(() => assertDefined(false)).not.toThrow();
      expect(() => assertDefined([])).not.toThrow();
      expect(() => assertDefined({})).not.toThrow();
    });

    it('should throw for undefined', () => {
      expect(() => assertDefined(undefined)).toThrow('Expected value to be defined');
    });

    it('should throw for null', () => {
      expect(() => assertDefined(null)).toThrow('Expected value to be defined');
    });

    it('should use custom message when provided', () => {
      expect(() => assertDefined(undefined, 'Custom error message')).toThrow('Custom error message');
    });

    it('should narrow type after assertion', () => {
      const value: string | undefined = 'test';

      assertDefined(value);

      // TypeScript should now know value is string, not string | undefined
      const length: number = value.length;
      expect(length).toBe(4);
    });
  });

  describe('expectExactValue', () => {
    it('should not throw when values match', () => {
      expect(() => expectExactValue(5, 5)).not.toThrow();
      expect(() => expectExactValue('test', 'test')).not.toThrow();
      expect(() => expectExactValue(true, true)).not.toThrow();
    });

    it('should throw when value is undefined', () => {
      expect(() => expectExactValue(undefined, 5)).toThrow('Expected value 5, but got undefined');
    });

    it('should throw when values do not match', () => {
      expect(() => expectExactValue(5, 10)).toThrow('Expected 10, but got 5');
      expect(() => expectExactValue('test', 'other')).toThrow('Expected "other", but got "test"');
    });

    it('should use custom message when provided', () => {
      expect(() => expectExactValue(5, 10, 'Values must match!')).toThrow('Values must match!');
    });

    it('should handle object comparison', () => {
      const obj1 = { a: 1 };
      const obj2 = { a: 2 };

      // Object equality is by reference, so this should throw
      expect(() => expectExactValue(obj1, obj2)).toThrow();
    });
  });
});
