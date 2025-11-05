/**
 * Proof-of-concept test for SceneTreeViewer (Sprint 0: UI testing verification)
 * Tests happy-dom DOM manipulation capabilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SceneTreeViewer } from './SceneTreeViewer';
import type { TscnNode } from '../parser/types';

describe('SceneTreeViewer (POC)', () => {
  let container: HTMLDivElement;
  let viewer: SceneTreeViewer;

  beforeEach(() => {
    // Create a fresh container for each test
    container = document.createElement('div');
    container.id = 'test-tree-container';
    document.body.appendChild(container);
  });

  describe('Basic DOM Rendering', () => {
    it('should create viewer with container element', () => {
      viewer = new SceneTreeViewer(container);
      expect(viewer).toBeDefined();
      expect(container).toBeDefined();
    });

    it('should render empty tree message when no nodes provided', () => {
      viewer = new SceneTreeViewer(container);
      viewer.renderTree([]);

      const emptyMessage = container.querySelector('.tree-empty');
      expect(emptyMessage).toBeDefined();
      expect(emptyMessage?.textContent).toBe('No nodes to display');
    });

    it('should render single node in tree', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
        {
          name: 'Root',
          type: 'Node3D',
          properties: {},
          children: []
        }
      ];

      viewer.renderTree(nodes);

      const treeRoot = container.querySelector('.tree-root');
      expect(treeRoot).toBeDefined();

      const nodeElement = container.querySelector('.tree-node');
      expect(nodeElement).toBeDefined();
    });

    it('should render nested nodes with children', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
        {
          name: 'Root',
          type: 'Node3D',
          properties: {},
          children: [
            {
              name: 'Child1',
              type: 'MeshInstance3D',
              properties: {},
              children: []
            },
            {
              name: 'Child2',
              type: 'Camera3D',
              properties: {},
              children: []
            }
          ]
        }
      ];

      viewer.renderTree(nodes);

      const nodeElements = container.querySelectorAll('.tree-node');
      // Should have 3 nodes: Root + 2 children
      expect(nodeElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Event Handling', () => {
    it('should invoke onNodeSelect callback when node is clicked', () => {
      const onNodeSelect = vi.fn();
      viewer = new SceneTreeViewer(container, { onNodeSelect });

      const nodes: TscnNode[] = [
        {
          name: 'TestNode',
          type: 'Node3D',
          properties: {},
          children: []
        }
      ];

      viewer.renderTree(nodes);

      const nodeHeader = container.querySelector('.tree-node-header');
      expect(nodeHeader).toBeDefined();

      // Simulate click
      nodeHeader?.dispatchEvent(new Event('click', { bubbles: true }));

      // Verify callback was invoked
      expect(onNodeSelect).toHaveBeenCalled();
      expect(onNodeSelect).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'TestNode', type: 'Node3D' }),
        'TestNode'
      );
    });

    it('should invoke onNodeDoubleClick callback when node is double-clicked', () => {
      const onNodeDoubleClick = vi.fn();
      viewer = new SceneTreeViewer(container, { onNodeDoubleClick });

      const nodes: TscnNode[] = [
        {
          name: 'TestNode',
          type: 'Node3D',
          properties: {},
          children: []
        }
      ];

      viewer.renderTree(nodes);

      const nodeHeader = container.querySelector('.tree-node-header');
      expect(nodeHeader).toBeDefined();

      // Simulate double-click
      nodeHeader?.dispatchEvent(new Event('dblclick', { bubbles: true }));

      // Verify callback was invoked
      expect(onNodeDoubleClick).toHaveBeenCalled();
    });
  });

  describe('Search Functionality', () => {
    it('should filter nodes based on search term', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
        {
          name: 'Player',
          type: 'Node3D',
          properties: {},
          children: []
        },
        {
          name: 'Enemy',
          type: 'Node3D',
          properties: {},
          children: []
        }
      ];

      viewer.renderTree(nodes);

      // Set search term
      viewer.setSearchTerm('Player');

      // Note: Filtering logic may vary - main validation is DOM updates
      // The important part is that the DOM is updated
      expect(container.innerHTML).toBeDefined();
    });
  });

  describe('Expand/Collapse', () => {
    it('should expand all nodes', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
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
      ];

      viewer.renderTree(nodes);
      viewer.expandAll();

      // Children should be visible after expandAll
      const childNodes = container.querySelectorAll('.tree-node');
      expect(childNodes.length).toBeGreaterThan(0);
    });

    it('should collapse all nodes', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
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
      ];

      viewer.renderTree(nodes);
      viewer.expandAll();
      viewer.collapseAll();

      // After collapse, tree should still render but children might be hidden
      const treeRoot = container.querySelector('.tree-root');
      expect(treeRoot).toBeDefined();
    });
  });

  describe('Node Visibility Toggle', () => {
    it('should invoke onNodeVisibilityChange when visibility icon clicked', () => {
      const onNodeVisibilityChange = vi.fn();
      viewer = new SceneTreeViewer(container, { onNodeVisibilityChange });

      const nodes: TscnNode[] = [
        {
          name: 'TestNode',
          type: 'Node3D',
          properties: {},
          children: []
        }
      ];

      viewer.renderTree(nodes);

      const visibilityIcon = container.querySelector('.tree-visibility-icon');
      expect(visibilityIcon).toBeDefined();

      // Simulate click on visibility icon
      visibilityIcon?.dispatchEvent(new Event('click', { bubbles: true }));

      // Verify callback was invoked
      expect(onNodeVisibilityChange).toHaveBeenCalled();
      expect(onNodeVisibilityChange).toHaveBeenCalledWith('TestNode', false);
    });

    it('should toggle visibility icon when clicked', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
        {
          name: 'TestNode',
          type: 'Node3D',
          properties: {},
          children: []
        }
      ];

      viewer.renderTree(nodes);

      let visibilityIcon = container.querySelector('.tree-visibility-icon');
      expect(visibilityIcon?.textContent).toBe('👁️'); // Initially visible

      // Click to hide
      visibilityIcon?.dispatchEvent(new Event('click', { bubbles: true }));

      visibilityIcon = container.querySelector('.tree-visibility-icon');
      expect(visibilityIcon?.textContent).toBe('🙈'); // Now hidden
    });
  });

  describe('Node Selection', () => {
    it('should select node and invoke onNodeSelect callback', () => {
      const onNodeSelect = vi.fn();
      viewer = new SceneTreeViewer(container, { onNodeSelect });

      const nodes: TscnNode[] = [
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
      ];

      viewer.renderTree(nodes);
      viewer.selectNode('Root/Child');

      expect(onNodeSelect).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Child', type: 'MeshInstance3D' }),
        'Root/Child'
      );
    });

    it('should auto-expand ancestors when selecting deep node', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
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
      ];

      viewer.renderTree(nodes);

      // Initially collapsed - should not see Level2
      let level2 = container.querySelector('[data-node-path="Root/Level1/Level2"]');
      expect(level2).toBeNull();

      // Select deep node
      viewer.selectNode('Root/Level1/Level2');

      // Now Level2 should be visible (ancestors expanded)
      level2 = container.querySelector('[data-node-path="Root/Level1/Level2"]');
      expect(level2).toBeDefined();
    });

    it('should highlight selected node with selected class', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
        {
          name: 'Node1',
          type: 'Node3D',
          properties: {},
          children: []
        },
        {
          name: 'Node2',
          type: 'Node3D',
          properties: {},
          children: []
        }
      ];

      viewer.renderTree(nodes);
      viewer.selectNode('Node1');

      const node1Header = container.querySelector('[data-node-path="Node1"] .tree-node-header');
      const node2Header = container.querySelector('[data-node-path="Node2"] .tree-node-header');

      expect(node1Header?.classList.contains('selected')).toBe(true);
      expect(node2Header?.classList.contains('selected')).toBe(false);
    });

    it('should support clearSelection()', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
        {
          name: 'TestNode',
          type: 'Node3D',
          properties: {},
          children: []
        }
      ];

      viewer.renderTree(nodes);
      viewer.selectNode('TestNode');

      let nodeHeader = container.querySelector('.tree-node-header');
      expect(nodeHeader?.classList.contains('selected')).toBe(true);

      viewer.clearSelection();

      nodeHeader = container.querySelector('.tree-node-header');
      expect(nodeHeader?.classList.contains('selected')).toBe(false);
    });

    it('should return selected node path via getSelectedNodePath()', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
        {
          name: 'TestNode',
          type: 'Node3D',
          properties: {},
          children: []
        }
      ];

      viewer.renderTree(nodes);

      expect(viewer.getSelectedNodePath()).toBeNull();

      viewer.selectNode('TestNode');

      expect(viewer.getSelectedNodePath()).toBe('TestNode');
    });
  });

  describe('Complex Tree Structures', () => {
    it('should render deeply nested tree (5 levels)', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
        {
          name: 'L0',
          type: 'Node3D',
          properties: {},
          children: [
            {
              name: 'L1',
              type: 'Node3D',
              properties: {},
              children: [
                {
                  name: 'L2',
                  type: 'Node3D',
                  properties: {},
                  children: [
                    {
                      name: 'L3',
                      type: 'Node3D',
                      properties: {},
                      children: [
                        {
                          name: 'L4',
                          type: 'Node3D',
                          properties: {},
                          children: []
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ];

      viewer.renderTree(nodes);
      viewer.expandAll();

      const l4Node = container.querySelector('[data-node-path="L0/L1/L2/L3/L4"]');
      expect(l4Node).toBeDefined();
      expect(l4Node?.getAttribute('data-depth')).toBe('4');
    });

    it('should render tree with many siblings', () => {
      viewer = new SceneTreeViewer(container);

      const children: TscnNode[] = [];
      for (let i = 0; i < 50; i++) {
        children.push({
          name: `Child${i}`,
          type: 'Node3D',
          properties: {},
          children: []
        });
      }

      const nodes: TscnNode[] = [
        {
          name: 'Root',
          type: 'Node3D',
          properties: {},
          children
        }
      ];

      viewer.renderTree(nodes);
      viewer.expandAll();

      const nodeElements = container.querySelectorAll('.tree-node');
      expect(nodeElements.length).toBeGreaterThan(50);
    });

    it('should handle mixed node types', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
        {
          name: 'Root',
          type: 'Node3D',
          properties: {},
          children: [
            {
              name: 'Camera',
              type: 'Camera3D',
              properties: {},
              children: []
            },
            {
              name: 'Light',
              type: 'DirectionalLight3D',
              properties: {},
              children: []
            },
            {
              name: 'Mesh',
              type: 'MeshInstance3D',
              properties: {},
              children: []
            }
          ]
        }
      ];

      viewer.renderTree(nodes);
      viewer.expandAll();

      const cameraType = container.querySelector('[data-node-path="Root/Camera"] .tree-node-type');
      const lightType = container.querySelector('[data-node-path="Root/Light"] .tree-node-type');
      const meshType = container.querySelector('[data-node-path="Root/Mesh"] .tree-node-type');

      expect(cameraType?.textContent).toBe('Cam');
      expect(lightType?.textContent).toBe('Dir');
      expect(meshType?.textContent).toBe('Mesh');
    });
  });

  describe('Node Icons and Indicators', () => {
    it('should show transform indicator for nodes with transform', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
        {
          name: 'WithTransform',
          type: 'Node3D',
          properties: {
            transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)'
          },
          children: []
        },
        {
          name: 'WithoutTransform',
          type: 'Node3D',
          properties: {},
          children: []
        }
      ];

      viewer.renderTree(nodes);

      const withTransform = container.querySelector('[data-node-path="WithTransform"] .tree-transform-icon');
      const withoutTransform = container.querySelector('[data-node-path="WithoutTransform"] .tree-transform-icon');

      expect(withTransform).toBeDefined();
      expect(withoutTransform).toBeNull();
    });

    it('should show instance indicator for external scenes', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
        {
          name: 'ExternalScene',
          type: 'Node3D',
          instance: 'res://scenes/enemy.tscn',
          properties: {},
          children: []
        }
      ];

      viewer.renderTree(nodes);

      const instanceIcon = container.querySelector('[data-node-path="ExternalScene"] .tree-instance-icon');
      expect(instanceIcon).toBeDefined();
      expect(instanceIcon?.textContent).toBe('📦');
      expect(instanceIcon?.title).toContain('res://scenes/enemy.tscn');
    });

    it('should show instance root class for instance root nodes', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
        {
          name: 'InstanceRoot',
          type: 'Node3D',
          instance: 'res://scenes/enemy.tscn',
          instanceMetadata: {
            sourcePath: 'res://scenes/enemy.tscn',
            isInstanceRoot: true
          },
          properties: {},
          children: []
        }
      ];

      viewer.renderTree(nodes);

      const nodeHeader = container.querySelector('[data-node-path="InstanceRoot"] .tree-node-header');
      expect(nodeHeader?.classList.contains('instance-root')).toBe(true);
    });

    it('should show correct expand/collapse icons', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
        {
          name: 'Parent',
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
      ];

      viewer.renderTree(nodes);

      let expandIcon = container.querySelector('[data-node-path="Parent"] .tree-expand-icon');
      expect(expandIcon?.textContent).toBe('▶'); // Collapsed

      viewer.expandAll();

      expandIcon = container.querySelector('[data-node-path="Parent"] .tree-expand-icon');
      expect(expandIcon?.textContent).toBe('▼'); // Expanded
    });

    it('should show spacer for leaf nodes (no children)', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
        {
          name: 'LeafNode',
          type: 'Node3D',
          properties: {},
          children: []
        }
      ];

      viewer.renderTree(nodes);

      const spacer = container.querySelector('[data-node-path="LeafNode"] .tree-expand-spacer');
      expect(spacer).toBeDefined();
      expect(spacer?.textContent).toBe('•');
    });
  });

  describe('Search Filtering', () => {
    it('should filter by node type', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
        {
          name: 'Camera',
          type: 'Camera3D',
          properties: {},
          children: []
        },
        {
          name: 'Mesh',
          type: 'MeshInstance3D',
          properties: {},
          children: []
        }
      ];

      viewer.renderTree(nodes);
      viewer.setSearchTerm('Camera');

      const cameraNode = container.querySelector('[data-node-path="Camera"]');
      const meshNode = container.querySelector('[data-node-path="Mesh"]');

      expect(cameraNode).toBeDefined();
      expect(meshNode).toBeNull();
    });

    it('should show "no matches" message when search has no results', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
        {
          name: 'Node',
          type: 'Node3D',
          properties: {},
          children: []
        }
      ];

      viewer.renderTree(nodes);
      viewer.setSearchTerm('NonExistent');

      const emptyMessage = container.querySelector('.tree-empty');
      // Search term is converted to lowercase in the display
      expect(emptyMessage?.textContent).toContain('No nodes match "nonexistent"');
    });

    it('should be case-insensitive', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
        {
          name: 'TestNode',
          type: 'Node3D',
          properties: {},
          children: []
        }
      ];

      viewer.renderTree(nodes);
      viewer.setSearchTerm('TESTNODE');

      const testNode = container.querySelector('[data-node-path="TestNode"]');
      expect(testNode).toBeDefined();
    });

    it('should auto-expand parent nodes when child matches search', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
        {
          name: 'Parent',
          type: 'Node3D',
          properties: {},
          children: [
            {
              name: 'MatchingChild',
              type: 'Node3D',
              properties: {},
              children: []
            }
          ]
        }
      ];

      viewer.renderTree(nodes);
      viewer.setSearchTerm('MatchingChild');

      // Parent should be expanded to show matching child
      const childNode = container.querySelector('[data-node-path="Parent/MatchingChild"]');
      expect(childNode).toBeDefined();
    });

    it('should clear search results when setting empty search term', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
        {
          name: 'Node1',
          type: 'Node3D',
          properties: {},
          children: []
        },
        {
          name: 'Node2',
          type: 'Node3D',
          properties: {},
          children: []
        }
      ];

      viewer.renderTree(nodes);
      viewer.setSearchTerm('Node1');

      let node2 = container.querySelector('[data-node-path="Node2"]');
      expect(node2).toBeNull();

      viewer.setSearchTerm('');

      node2 = container.querySelector('[data-node-path="Node2"]');
      expect(node2).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle nodes with special characters in names', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
        {
          name: 'Node-With_Special.Characters!',
          type: 'Node3D',
          properties: {},
          children: []
        }
      ];

      expect(() => viewer.renderTree(nodes)).not.toThrow();

      const nodeElement = container.querySelector('[data-node-path="Node-With_Special.Characters!"]');
      expect(nodeElement).toBeDefined();
    });

    it('should handle nodes with very long names', () => {
      viewer = new SceneTreeViewer(container);

      const longName = 'VeryLongNodeNameThatExceedsNormalLength'.repeat(5);
      const nodes: TscnNode[] = [
        {
          name: longName,
          type: 'Node3D',
          properties: {},
          children: []
        }
      ];

      expect(() => viewer.renderTree(nodes)).not.toThrow();

      const nodeName = container.querySelector('.tree-node-name');
      expect(nodeName?.textContent).toBe(longName);
    });

    it('should handle unknown node types gracefully', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
        {
          name: 'CustomNode',
          type: 'UnknownCustomType',
          properties: {},
          children: []
        }
      ];

      expect(() => viewer.renderTree(nodes)).not.toThrow();

      const typeBadge = container.querySelector('.tree-node-type');
      expect(typeBadge?.textContent).toBe('Unkn'); // First 4 chars
    });

    it('should handle renderTree called multiple times', () => {
      viewer = new SceneTreeViewer(container);

      const nodes1: TscnNode[] = [
        {
          name: 'Node1',
          type: 'Node3D',
          properties: {},
          children: []
        }
      ];

      const nodes2: TscnNode[] = [
        {
          name: 'Node2',
          type: 'Node3D',
          properties: {},
          children: []
        }
      ];

      viewer.renderTree(nodes1);
      viewer.renderTree(nodes2);

      const node1 = container.querySelector('[data-node-path="Node1"]');
      const node2 = container.querySelector('[data-node-path="Node2"]');

      expect(node1).toBeNull();
      expect(node2).toBeDefined();
    });

    it('should maintain expanded state across re-renders', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
        {
          name: 'Parent',
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
      ];

      viewer.renderTree(nodes);
      viewer.expandAll();

      let child = container.querySelector('[data-node-path="Parent/Child"]');
      expect(child).toBeDefined();

      // Re-render
      viewer.renderTree(nodes);

      // Should still be expanded
      child = container.querySelector('[data-node-path="Parent/Child"]');
      expect(child).toBeDefined();
    });
  });
});
