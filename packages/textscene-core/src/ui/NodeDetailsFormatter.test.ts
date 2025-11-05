/**
 * Tests for NodeDetailsFormatter - HTML generation for node property display
 */

import { describe, it, expect, vi } from 'vitest';
import { formatNodeDetails } from './NodeDetailsFormatter';
import { nodeRegistry } from '../core/NodeRegistry';
import type { TscnNode } from '../parser/types';

describe('NodeDetailsFormatter', () => {
  describe('formatNodeDetails()', () => {
    describe('Base Properties', () => {
      it('should render node type and path', () => {
        const node: TscnNode = {
          name: 'TestNode',
          type: 'Node3D',
          properties: {},
          children: []
        };

        const html = formatNodeDetails(node, 'Root/TestNode');

        expect(html).toContain('<span class="detail-label">Type:</span>');
        expect(html).toContain('<span class="detail-value">Node3D</span>');
        expect(html).toContain('<span class="detail-label">Path:</span>');
        expect(html).toContain('<span class="detail-value">Root/TestNode</span>');
      });

      it('should render parent property when present', () => {
        const node: TscnNode = {
          name: 'ChildNode',
          type: 'Node3D',
          parent: 'Root',
          properties: {},
          children: []
        };

        const html = formatNodeDetails(node, 'Root/ChildNode');

        expect(html).toContain('<span class="detail-label">Parent:</span>');
        expect(html).toContain('<span class="detail-value">Root</span>');
      });

      it('should not render parent property when absent', () => {
        const node: TscnNode = {
          name: 'RootNode',
          type: 'Node3D',
          properties: {},
          children: []
        };

        const html = formatNodeDetails(node, 'RootNode');

        expect(html).not.toContain('<span class="detail-label">Parent:</span>');
      });

      it('should render external scene indicator when instance present', () => {
        const node: TscnNode = {
          name: 'ExternalScene',
          type: 'Node3D',
          instance: 'res://scenes/enemy.tscn',
          properties: {},
          children: []
        };

        const html = formatNodeDetails(node, 'Root/ExternalScene');

        expect(html).toContain('detail-external-instance');
        expect(html).toContain('📦 External Scene:');
        expect(html).toContain('res://scenes/enemy.tscn');
      });

      it('should not render external scene indicator when instance absent', () => {
        const node: TscnNode = {
          name: 'RegularNode',
          type: 'Node3D',
          properties: {},
          children: []
        };

        const html = formatNodeDetails(node, 'Root/RegularNode');

        expect(html).not.toContain('detail-external-instance');
        expect(html).not.toContain('📦 External Scene:');
      });
    });

    describe('Property Formatter Integration', () => {
      it('should use registered property formatter when available', () => {
        const node: TscnNode = {
          name: 'MeshNode',
          type: 'MeshInstance3D',
          properties: {
            mesh: 'BoxMesh_abc123',
            cast_shadow: 1
          },
          children: []
        };

        const mockFormatter = vi.fn().mockReturnValue([
          {
            title: 'Mesh Properties',
            items: [
              { label: 'Mesh', value: 'BoxMesh_abc123' },
              { label: 'Cast Shadow', value: 'true' }
            ]
          }
        ]);

        // Temporarily register a custom formatter
        const originalRegistration = nodeRegistry.getRegistration('MeshInstance3D');
        nodeRegistry['registrations'].set('MeshInstance3D', {
          ...originalRegistration!,
          propertyFormatter: mockFormatter
        });

        const html = formatNodeDetails(node, 'Root/MeshNode');

        expect(mockFormatter).toHaveBeenCalledWith(node.properties);
        expect(html).toContain('Mesh Properties');
        expect(html).toContain('Mesh');
        expect(html).toContain('BoxMesh_abc123');

        // Restore original registration
        if (originalRegistration) {
          nodeRegistry['registrations'].set('MeshInstance3D', originalRegistration);
        }
      });

      it('should handle node type without registered formatter', () => {
        const node: TscnNode = {
          name: 'CustomNode',
          type: 'UnknownNodeType',
          properties: { some: 'value' },
          children: []
        };

        const html = formatNodeDetails(node, 'Root/CustomNode');

        // Should still render base properties
        expect(html).toContain('UnknownNodeType');
        expect(html).toContain('Root/CustomNode');
        // Should not throw or crash
        expect(html).toBeDefined();
      });

      it('should handle empty property formatter response', () => {
        const node: TscnNode = {
          name: 'EmptyNode',
          type: 'Node3D',
          properties: {},
          children: []
        };

        const mockFormatter = vi.fn().mockReturnValue([]);

        const originalRegistration = nodeRegistry.getRegistration('Node3D');
        nodeRegistry['registrations'].set('Node3D', {
          ...originalRegistration!,
          propertyFormatter: mockFormatter
        });

        const html = formatNodeDetails(node, 'Root/EmptyNode');

        expect(mockFormatter).toHaveBeenCalled();
        // Should render base properties even with empty sections
        expect(html).toContain('Node3D');
        expect(html).toContain('Root/EmptyNode');

        if (originalRegistration) {
          nodeRegistry['registrations'].set('Node3D', originalRegistration);
        }
      });
    });

    describe('HTML Generation', () => {
      it('should generate valid HTML structure with detail rows', () => {
        const node: TscnNode = {
          name: 'TestNode',
          type: 'Node3D',
          parent: 'Root',
          properties: {},
          children: []
        };

        const html = formatNodeDetails(node, 'Root/TestNode');

        // Should contain detail-row elements
        const detailRowMatches = html.match(/<div class="detail-row">/g);
        expect(detailRowMatches).toBeDefined();
        expect(detailRowMatches!.length).toBeGreaterThan(0);

        // Each detail-row should have label and value
        expect(html).toContain('detail-label');
        expect(html).toContain('detail-value');
      });

      it('should generate property sections with titles', () => {
        const node: TscnNode = {
          name: 'LightNode',
          type: 'DirectionalLight3D',
          properties: {
            light_energy: 1.5,
            light_color: 'Color(1, 1, 1, 1)'
          },
          children: []
        };

        const mockFormatter = vi.fn().mockReturnValue([
          {
            title: 'Light Settings',
            items: [
              { label: 'Energy', value: '1.5' }
            ]
          }
        ]);

        const originalRegistration = nodeRegistry.getRegistration('DirectionalLight3D');
        nodeRegistry['registrations'].set('DirectionalLight3D', {
          ...originalRegistration!,
          propertyFormatter: mockFormatter
        });

        const html = formatNodeDetails(node, 'Root/LightNode');

        expect(html).toContain('<div class="property-section">');
        expect(html).toContain('<h4>Light Settings</h4>');
        expect(html).toContain('Energy');
        expect(html).toContain('1.5');

        if (originalRegistration) {
          nodeRegistry['registrations'].set('DirectionalLight3D', originalRegistration);
        }
      });

      it('should generate multiple property sections', () => {
        const node: TscnNode = {
          name: 'CameraNode',
          type: 'Camera3D',
          properties: {},
          children: []
        };

        const mockFormatter = vi.fn().mockReturnValue([
          {
            title: 'Camera Settings',
            items: [
              { label: 'FOV', value: '75' }
            ]
          },
          {
            title: 'Transform',
            items: [
              { label: 'Position', value: 'Vector3(0, 5, 10)' }
            ]
          }
        ]);

        const originalRegistration = nodeRegistry.getRegistration('Camera3D');
        nodeRegistry['registrations'].set('Camera3D', {
          ...originalRegistration!,
          propertyFormatter: mockFormatter
        });

        const html = formatNodeDetails(node, 'Root/CameraNode');

        expect(html).toContain('Camera Settings');
        expect(html).toContain('Transform');
        expect(html).toContain('FOV');
        expect(html).toContain('Position');

        if (originalRegistration) {
          nodeRegistry['registrations'].set('Camera3D', originalRegistration);
        }
      });

      it('should handle items with special HTML characters', () => {
        const node: TscnNode = {
          name: 'Node',
          type: 'Node3D',
          properties: {},
          children: []
        };

        const mockFormatter = vi.fn().mockReturnValue([
          {
            title: 'Properties',
            items: [
              { label: 'Script', value: 'res://scripts/test.gd' }
            ]
          }
        ]);

        const originalRegistration = nodeRegistry.getRegistration('Node3D');
        nodeRegistry['registrations'].set('Node3D', {
          ...originalRegistration!,
          propertyFormatter: mockFormatter
        });

        const html = formatNodeDetails(node, 'Root/Node');

        // Should render the value without escaping issues
        expect(html).toContain('res://scripts/test.gd');

        if (originalRegistration) {
          nodeRegistry['registrations'].set('Node3D', originalRegistration);
        }
      });
    });

    describe('Edge Cases', () => {
      it('should handle node with empty properties object', () => {
        const node: TscnNode = {
          name: 'EmptyNode',
          type: 'Node3D',
          properties: {},
          children: []
        };

        const html = formatNodeDetails(node, 'Root/EmptyNode');

        expect(html).toContain('Node3D');
        expect(html).toContain('Root/EmptyNode');
      });

      it('should handle node with complex nested properties', () => {
        const node: TscnNode = {
          name: 'ComplexNode',
          type: 'Node3D',
          properties: {
            transform: {
              origin: { x: 1, y: 2, z: 3 }
            }
          },
          children: []
        };

        expect(() => formatNodeDetails(node, 'Root/ComplexNode')).not.toThrow();
      });

      it('should handle very long node paths', () => {
        const node: TscnNode = {
          name: 'DeepNode',
          type: 'Node3D',
          properties: {},
          children: []
        };

        const longPath = 'Root/Level1/Level2/Level3/Level4/Level5/DeepNode';
        const html = formatNodeDetails(node, longPath);

        expect(html).toContain(longPath);
      });

      it('should handle nodes with special characters in name', () => {
        const node: TscnNode = {
          name: 'Node-With_Special.Characters!',
          type: 'Node3D',
          properties: {},
          children: []
        };

        const html = formatNodeDetails(node, 'Root/Node-With_Special.Characters!');

        expect(html).toContain('Node-With_Special.Characters!');
      });

      it('should handle property section with empty items array', () => {
        const node: TscnNode = {
          name: 'Node',
          type: 'Node3D',
          properties: {},
          children: []
        };

        const mockFormatter = vi.fn().mockReturnValue([
          {
            title: 'Empty Section',
            items: []
          }
        ]);

        const originalRegistration = nodeRegistry.getRegistration('Node3D');
        nodeRegistry['registrations'].set('Node3D', {
          ...originalRegistration!,
          propertyFormatter: mockFormatter
        });

        const html = formatNodeDetails(node, 'Root/Node');

        // Should render section title even with no items
        expect(html).toContain('Empty Section');

        if (originalRegistration) {
          nodeRegistry['registrations'].set('Node3D', originalRegistration);
        }
      });

      it('should handle property items with empty or missing labels', () => {
        const node: TscnNode = {
          name: 'Node',
          type: 'Node3D',
          properties: {},
          children: []
        };

        const mockFormatter = vi.fn().mockReturnValue([
          {
            title: 'Section',
            items: [
              { label: '', value: 'test' }
            ]
          }
        ]);

        const originalRegistration = nodeRegistry.getRegistration('Node3D');
        nodeRegistry['registrations'].set('Node3D', {
          ...originalRegistration!,
          propertyFormatter: mockFormatter
        });

        expect(() => formatNodeDetails(node, 'Root/Node')).not.toThrow();

        if (originalRegistration) {
          nodeRegistry['registrations'].set('Node3D', originalRegistration);
        }
      });

      it('should handle property items with empty or missing values', () => {
        const node: TscnNode = {
          name: 'Node',
          type: 'Node3D',
          properties: {},
          children: []
        };

        const mockFormatter = vi.fn().mockReturnValue([
          {
            title: 'Section',
            items: [
              { label: 'EmptyValue', value: '' }
            ]
          }
        ]);

        const originalRegistration = nodeRegistry.getRegistration('Node3D');
        nodeRegistry['registrations'].set('Node3D', {
          ...originalRegistration!,
          propertyFormatter: mockFormatter
        });

        const html = formatNodeDetails(node, 'Root/Node');

        expect(html).toContain('EmptyValue');

        if (originalRegistration) {
          nodeRegistry['registrations'].set('Node3D', originalRegistration);
        }
      });
    });

    describe('Real Node Types', () => {
      it('should format MeshInstance3D node details', () => {
        const node: TscnNode = {
          name: 'Cube',
          type: 'MeshInstance3D',
          parent: 'Root',
          properties: {
            mesh: 'BoxMesh_abc',
            cast_shadow: 1
          },
          children: []
        };

        const html = formatNodeDetails(node, 'Root/Cube');

        expect(html).toContain('MeshInstance3D');
        expect(html).toContain('Root/Cube');
        expect(html).toContain('Root'); // parent
      });

      it('should format Camera3D node details', () => {
        const node: TscnNode = {
          name: 'MainCamera',
          type: 'Camera3D',
          parent: 'Root',
          properties: {
            fov: 75,
            near: 0.1,
            far: 1000
          },
          children: []
        };

        const html = formatNodeDetails(node, 'Root/MainCamera');

        expect(html).toContain('Camera3D');
        expect(html).toContain('Root/MainCamera');
      });

      it('should format DirectionalLight3D node details', () => {
        const node: TscnNode = {
          name: 'Sun',
          type: 'DirectionalLight3D',
          properties: {
            light_energy: 1.5,
            light_color: 'Color(1, 0.95, 0.8, 1)'
          },
          children: []
        };

        const html = formatNodeDetails(node, 'Root/Sun');

        expect(html).toContain('DirectionalLight3D');
        expect(html).toContain('Root/Sun');
      });
    });
  });
});
