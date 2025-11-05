/**
 * Tests for NodeRegistry - Central registry for TSCN node types
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import {
  nodeRegistry,
  parseNodeWithRegistry,
  renderNodeWithRegistry,
  type NodeTypeRegistration
} from './NodeRegistry';
import type { ParsedHeading } from '../parser/utils';
import * as logger from '../logger';

describe('NodeRegistry', () => {
  // Test registration samples
  const testRegistration: NodeTypeRegistration = {
    typeName: 'TestNode',
    typeGuard: (heading: ParsedHeading) => heading.attributes.type === 'TestNode',
    parser: (heading: ParsedHeading, properties: Record<string, string>) => ({
      name: heading.attributes.name || 'Unnamed',
      parent: heading.attributes.parent,
      testProp: properties.testProp || 'default'
    }),
    renderer: (name: string, properties: any) => {
      const obj = new THREE.Object3D();
      obj.name = name;
      obj.userData.testProp = properties.testProp;
      return obj;
    }
  };

  const node3dRegistration: NodeTypeRegistration = {
    typeName: 'Node3D',
    typeGuard: (heading: ParsedHeading) => heading.attributes.type === 'Node3D',
    parser: (heading: ParsedHeading, properties: Record<string, string>) => ({
      name: heading.attributes.name || 'Unnamed',
      parent: heading.attributes.parent,
      transform: properties.transform
    }),
    renderer: (name: string, _properties: any) => {
      const obj = new THREE.Object3D();
      obj.name = name;
      return obj;
    }
  };

  const nodeRegistration: NodeTypeRegistration = {
    typeName: 'Node',
    typeGuard: (heading: ParsedHeading) => heading.attributes.type === 'Node',
    parser: (heading: ParsedHeading, _properties: Record<string, string>) => ({
      name: heading.attributes.name || 'Unnamed',
      parent: heading.attributes.parent
    }),
    renderer: (name: string, _properties: any) => {
      const obj = new THREE.Object3D();
      obj.name = name;
      return obj;
    }
  };

  beforeEach(() => {
    nodeRegistry.clear();
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    nodeRegistry.clear();
  });

  describe('register', () => {
    it('should register a new node type', () => {
      nodeRegistry.register(testRegistration);
      const retrieved = nodeRegistry.getRegistration('TestNode');
      expect(retrieved).toBe(testRegistration);
    });

    it('should warn when overwriting existing registration', () => {
      nodeRegistry.register(testRegistration);
      nodeRegistry.register(testRegistration);

      expect(logger.warn).toHaveBeenCalledWith(
        'Node type "TestNode" is already registered. Overwriting.'
      );
    });

    it('should successfully overwrite existing registration', () => {
      const firstRegistration = { ...testRegistration };
      const secondRegistration = {
        ...testRegistration,
        parser: vi.fn().mockReturnValue({ name: 'Different' })
      };

      nodeRegistry.register(firstRegistration);
      nodeRegistry.register(secondRegistration);

      const retrieved = nodeRegistry.getRegistration('TestNode');
      expect(retrieved).toBe(secondRegistration);
      expect(retrieved).not.toBe(firstRegistration);
    });

    it('should register multiple different types', () => {
      nodeRegistry.register(testRegistration);
      nodeRegistry.register(node3dRegistration);

      expect(nodeRegistry.getRegistration('TestNode')).toBe(testRegistration);
      expect(nodeRegistry.getRegistration('Node3D')).toBe(node3dRegistration);
    });
  });

  describe('findRegistration', () => {
    it('should find registration by type guard', () => {
      nodeRegistry.register(testRegistration);

      const heading: ParsedHeading = {
        headingName: 'node',
        attributes: { type: 'TestNode', name: 'MyNode' }
      };

      const found = nodeRegistry.findRegistration(heading);
      expect(found).toBe(testRegistration);
    });

    it('should return null when no matching type guard', () => {
      nodeRegistry.register(testRegistration);

      const heading: ParsedHeading = {
        headingName: 'node',
        attributes: { type: 'UnknownType', name: 'MyNode' }
      };

      const found = nodeRegistry.findRegistration(heading);
      expect(found).toBeNull();
    });

    it('should find correct registration when multiple types registered', () => {
      nodeRegistry.register(testRegistration);
      nodeRegistry.register(node3dRegistration);

      const heading: ParsedHeading = {
        headingName: 'node',
        attributes: { type: 'Node3D', name: 'MyNode' }
      };

      const found = nodeRegistry.findRegistration(heading);
      expect(found).toBe(node3dRegistration);
    });

    it('should return first matching registration when multiple guards match', () => {
      const broadGuardRegistration: NodeTypeRegistration = {
        ...testRegistration,
        typeName: 'BroadType',
        typeGuard: (_heading: ParsedHeading) => true // Always matches
      };

      nodeRegistry.register(broadGuardRegistration);
      nodeRegistry.register(testRegistration);

      const heading: ParsedHeading = {
        headingName: 'node',
        attributes: { type: 'TestNode', name: 'MyNode' }
      };

      // Should return first registration (BroadType) since it matches first
      const found = nodeRegistry.findRegistration(heading);
      expect(found).toBe(broadGuardRegistration);
    });
  });

  describe('getRegistration', () => {
    it('should get registration by type name', () => {
      nodeRegistry.register(testRegistration);

      const retrieved = nodeRegistry.getRegistration('TestNode');
      expect(retrieved).toBe(testRegistration);
    });

    it('should return null for unknown type name', () => {
      nodeRegistry.register(testRegistration);

      const retrieved = nodeRegistry.getRegistration('UnknownType');
      expect(retrieved).toBeNull();
    });

    it('should return correct registration when multiple types registered', () => {
      nodeRegistry.register(testRegistration);
      nodeRegistry.register(node3dRegistration);

      const retrieved = nodeRegistry.getRegistration('Node3D');
      expect(retrieved).toBe(node3dRegistration);
    });
  });

  describe('getAllTypeNames', () => {
    it('should return empty array when no registrations', () => {
      const typeNames = nodeRegistry.getAllTypeNames();
      expect(typeNames).toEqual([]);
    });

    it('should return all registered type names', () => {
      nodeRegistry.register(testRegistration);
      nodeRegistry.register(node3dRegistration);
      nodeRegistry.register(nodeRegistration);

      const typeNames = nodeRegistry.getAllTypeNames();
      expect(typeNames).toHaveLength(3);
      expect(typeNames).toContain('TestNode');
      expect(typeNames).toContain('Node3D');
      expect(typeNames).toContain('Node');
    });

    it('should not include duplicates after overwrite', () => {
      nodeRegistry.register(testRegistration);
      nodeRegistry.register(testRegistration);

      const typeNames = nodeRegistry.getAllTypeNames();
      expect(typeNames).toEqual(['TestNode']);
    });
  });

  describe('clear', () => {
    it('should remove all registrations', () => {
      nodeRegistry.register(testRegistration);
      nodeRegistry.register(node3dRegistration);

      nodeRegistry.clear();

      expect(nodeRegistry.getAllTypeNames()).toEqual([]);
      expect(nodeRegistry.getRegistration('TestNode')).toBeNull();
      expect(nodeRegistry.getRegistration('Node3D')).toBeNull();
    });

    it('should allow new registrations after clear', () => {
      nodeRegistry.register(testRegistration);
      nodeRegistry.clear();
      nodeRegistry.register(node3dRegistration);

      expect(nodeRegistry.getAllTypeNames()).toEqual(['Node3D']);
    });
  });

  describe('parseNodeWithRegistry', () => {
    it('should parse node using registered parser', () => {
      nodeRegistry.register(testRegistration);

      const heading: ParsedHeading = {
        headingName: 'node',
        attributes: { type: 'TestNode', name: 'MyNode' }
      };
      const properties = { testProp: 'myValue' };

      const node = parseNodeWithRegistry(heading, properties);

      expect(node).toBeDefined();
      expect(node?.name).toBe('MyNode');
      expect(node?.type).toBe('TestNode');
      expect(node?.properties.testProp).toBe('myValue');
    });

    it('should fall back to Node type for unsupported types', () => {
      nodeRegistry.register(nodeRegistration);

      const heading: ParsedHeading = {
        headingName: 'node',
        attributes: { type: 'UnsupportedType', name: 'MyNode' }
      };

      const node = parseNodeWithRegistry(heading, {});

      expect(node).toBeDefined();
      expect(node?.type).toBe('Node');
      expect(node?.name).toBe('MyNode');
      expect(logger.warn).toHaveBeenCalledWith(
        'Unsupported node type: UnsupportedType - using Node fallback'
      );
    });

    it('should handle instance nodes without warning', () => {
      nodeRegistry.register(nodeRegistration);

      const heading: ParsedHeading = {
        headingName: 'node',
        attributes: { name: 'Enemy1', instance: 'ExtResource("2_abcde")' }
      };

      const node = parseNodeWithRegistry(heading, {});

      expect(node).toBeDefined();
      expect(node?.instance).toBe('ExtResource("2_abcde")');
      // Should not warn for instance nodes
      expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('Unsupported'));
    });

    it('should capture instance from heading attributes', () => {
      nodeRegistry.register(testRegistration);

      const heading: ParsedHeading = {
        headingName: 'node',
        attributes: { type: 'TestNode', name: 'MyNode', instance: 'ExtResource("1")' }
      };

      const node = parseNodeWithRegistry(heading, {});

      expect(node?.instance).toBe('ExtResource("1")');
    });

    it('should capture instance from properties', () => {
      nodeRegistry.register(testRegistration);

      const heading: ParsedHeading = {
        headingName: 'node',
        attributes: { type: 'TestNode', name: 'MyNode' }
      };
      const properties = { instance: 'ExtResource("2")' };

      const node = parseNodeWithRegistry(heading, properties);

      expect(node?.instance).toBe('ExtResource("2")');
    });

    it('should prefer instance from heading over properties', () => {
      nodeRegistry.register(testRegistration);

      const heading: ParsedHeading = {
        headingName: 'node',
        attributes: { type: 'TestNode', name: 'MyNode', instance: 'ExtResource("1")' }
      };
      const properties = { instance: 'ExtResource("2")' };

      const node = parseNodeWithRegistry(heading, properties);

      expect(node?.instance).toBe('ExtResource("1")');
    });

    it('should return null when Node fallback not registered', () => {
      const heading: ParsedHeading = {
        headingName: 'node',
        attributes: { type: 'UnsupportedType', name: 'MyNode' }
      };

      const node = parseNodeWithRegistry(heading, {});

      expect(node).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        'Node registration not found - cannot create fallback node'
      );
    });

    it('should handle parent attribute', () => {
      nodeRegistry.register(testRegistration);

      const heading: ParsedHeading = {
        headingName: 'node',
        attributes: { type: 'TestNode', name: 'Child', parent: '.' }
      };

      const node = parseNodeWithRegistry(heading, {});

      expect(node?.parent).toBe('.');
    });
  });

  describe('renderNodeWithRegistry', () => {
    it('should render node using registered renderer', () => {
      nodeRegistry.register(testRegistration);

      const node = {
        name: 'MyNode',
        type: 'TestNode',
        children: [],
        properties: { testProp: 'myValue' }
      };

      const object = renderNodeWithRegistry(node);

      expect(object).toBeDefined();
      expect(object?.name).toBe('MyNode');
      expect(object?.userData.testProp).toBe('myValue');
    });

    it('should warn for unsupported node type', () => {
      const node = {
        name: 'MyNode',
        type: 'UnsupportedType',
        children: [],
        properties: {}
      };

      const object = renderNodeWithRegistry(node);

      expect(object).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        'Unsupported node type for rendering: UnsupportedType'
      );
    });

    it('should pass TscnScene to renderer when provided', () => {
      const mockRenderer = vi.fn().mockReturnValue(new THREE.Object3D());
      const registrationWithScene: NodeTypeRegistration = {
        ...testRegistration,
        renderer: mockRenderer
      };

      nodeRegistry.register(registrationWithScene);

      const node = {
        name: 'MyNode',
        type: 'TestNode',
        children: [],
        properties: {}
      };

      const scene = {
        format: 3,
        nodes: [],
        externalResources: [],
        subResources: []
      };

      renderNodeWithRegistry(node, scene);

      expect(mockRenderer).toHaveBeenCalledWith('MyNode', node.properties, scene);
    });

    it('should render without scene when not provided', () => {
      nodeRegistry.register(testRegistration);

      const node = {
        name: 'MyNode',
        type: 'TestNode',
        children: [],
        properties: { testProp: 'value' }
      };

      const object = renderNodeWithRegistry(node);

      expect(object).toBeDefined();
    });
  });

  describe('Integration', () => {
    it('should parse and render a node end-to-end', () => {
      nodeRegistry.register(testRegistration);

      // Parse
      const heading: ParsedHeading = {
        headingName: 'node',
        attributes: { type: 'TestNode', name: 'MyNode' }
      };
      const properties = { testProp: 'myValue' };

      const node = parseNodeWithRegistry(heading, properties);
      expect(node).toBeDefined();

      // Render
      const object = renderNodeWithRegistry(node!);
      expect(object).toBeDefined();
      expect(object?.name).toBe('MyNode');
      expect(object?.userData.testProp).toBe('myValue');
    });

    it('should handle multiple node types correctly', () => {
      nodeRegistry.register(testRegistration);
      nodeRegistry.register(node3dRegistration);

      // Parse TestNode
      const testHeading: ParsedHeading = {
        headingName: 'node',
        attributes: { type: 'TestNode', name: 'TestNode1' }
      };
      const testNode = parseNodeWithRegistry(testHeading, {});
      expect(testNode?.type).toBe('TestNode');

      // Parse Node3D
      const node3dHeading: ParsedHeading = {
        headingName: 'node',
        attributes: { type: 'Node3D', name: 'Node3D1' }
      };
      const node3dNode = parseNodeWithRegistry(node3dHeading, {});
      expect(node3dNode?.type).toBe('Node3D');

      // Render both
      const testObject = renderNodeWithRegistry(testNode!);
      const node3dObject = renderNodeWithRegistry(node3dNode!);

      expect(testObject?.name).toBe('TestNode1');
      expect(node3dObject?.name).toBe('Node3D1');
    });
  });
});
